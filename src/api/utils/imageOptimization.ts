import { logger } from './logs/winston';
import sharp from 'sharp';
import fs from 'fs';

const calculateTargetDimensions = (width: number, height: number, config: any) => {
    const aspectRatio = width / height;
    const widthConstrained = width > config.maxWidth ? { width: config.maxWidth, height: Math.round(config.maxWidth / aspectRatio) } : { width, height };
    const heightConstrained = widthConstrained.height > config.maxHeight ? { width: Math.round(config.maxHeight * aspectRatio), height: config.maxHeight } : widthConstrained;

    const targetWidth = Math.round(heightConstrained.width / 2) * 2;
    const targetHeight = Math.round(heightConstrained.height / 2) * 2;

    return { targetWidth, targetHeight };
};

const getOptimalQuality = (width?: number, height?: number, isOriginalRoute: boolean = false, defaultQuality: number = 100): number => {
    if (defaultQuality !== 100) return defaultQuality;
    if (isOriginalRoute) return 100;

    const smallSize = (width && width <= 200) || (height && height <= 200);
    const mediumSize = (width && width <= 800) || (height && height <= 800);

    return smallSize ? 75 : mediumSize ? 80 : 85;
};

const processSharpImage = async (image: sharp.Sharp, outputPath: string, options: { resize?: any; quality: number; removeMetadata?: boolean; isOnTheFly?: boolean }) => {
    const { resize, quality, removeMetadata = true, isOnTheFly = false } = options;

    const pipeline = [
        removeMetadata ? (img: sharp.Sharp) => img.rotate() : (img: sharp.Sharp) => img,
        resize ? (img: sharp.Sharp) => img.resize(resize) : (img: sharp.Sharp) => img,
        (img: sharp.Sharp) => img.webp({ quality, effort: isOnTheFly ? 4 : 6, lossless: false, smartSubsample: true })
    ].reduce((acc, fn) => fn(acc), image);

    if (outputPath.endsWith('.tmp') || isOnTheFly) {
        return await pipeline.toBuffer();
    } else {
        await pipeline.toFile(outputPath);
        return fs.statSync(outputPath).size;
    }
};

const logCompressionResults = (originalSize: number, finalSize: number, startTime: number) => {
    const compressionRatio = parseFloat((((originalSize - finalSize) / originalSize) * 100).toFixed(1));
    const finalSizeKB = parseFloat((finalSize / 1024).toFixed(1));
    const processingTime = Date.now() - startTime;

    console.log(`📦 ${finalSizeKB}KB (${compressionRatio}% reduction)`);
    console.log(`🏁 ${processingTime}ms`);
    console.log('='.repeat(60));

    return { compressionRatio, finalSizeKB, processingTime };
};

export const processImageOnTheFly = async (imageBuffer: Buffer, options: { width?: number; height?: number; quality?: number; isOriginalRoute?: boolean }) => {
    try {
        const { width, height, quality, isOriginalRoute = false } = options;

        console.log(`📐 On-the-fly processing: ${width || 'auto'}x${height || 'auto'}, quality: ${quality || 'default'}`);
        console.log(`📍 Route type: ${isOriginalRoute ? 'ORIGINAL' : 'FULL'}`);

        const image = sharp(imageBuffer);
        const metadata = await image.metadata();

        console.log(`📊 Source: ${metadata.width}x${metadata.height}px, format: ${metadata.format}`);
        const resizeConfig =
            width || height
                ? {
                      ...(width && { width }),
                      ...(height && { height }),
                      fit: width && height ? ('cover' as const) : ('inside' as const),
                      ...(width && height && { position: 'centre' as const }),
                      ...((!width || !height) && { withoutEnlargement: true })
                  }
                : null;

        const webpQuality = getOptimalQuality(width, height, isOriginalRoute, quality);
        console.log(`⚙️  WebP quality: ${webpQuality}${quality === undefined ? ' (auto)' : ' (specified)'}`);

        const sharpConfig = {
            resize: resizeConfig,
            quality: webpQuality,
            removeMetadata: Boolean(process.env.USE_STRIPMETADATA),
            isOnTheFly: true
        };

        const processedBuffer = (await processSharpImage(image, '', sharpConfig)) as Buffer;

        const finalSizeKB = (processedBuffer.length / 1024).toFixed(1);
        console.log(`✅ On-the-fly result: ${finalSizeKB}KB (route: ${isOriginalRoute ? 'original' : 'full'})`);

        return processedBuffer;
    } catch (error) {
        console.error('❌ Error in on-the-fly processing:', error);
        return null;
    }
};

const optimizeIteratively = async (inputPath: string, outputPath: string, params: any) => {
    const { width, height, targetWidth, targetHeight, needsResize, config, removeMetadata = Boolean(process.env.USE_STRIPMETADATA) } = params;
    const tempPath = `${outputPath}.tmp`;

    const attemptOptimization = async (quality: number, currentWidth: number, currentHeight: number, iteration: number): Promise<any> => {
        console.log(`🔄 Attempt ${iteration}/${config.maxIterations} (Q:${quality})`);

        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

        const image = sharp(inputPath);

        const resize =
            needsResize || currentWidth !== width || currentHeight !== height
                ? {
                      width: currentWidth,
                      height: currentHeight,
                      fit: 'inside' as const,
                      withoutEnlargement: true
                  }
                : null;

        await processSharpImage(image, tempPath, {
            resize,
            quality,
            removeMetadata,
            isOnTheFly: false
        });

        const stats = fs.statSync(tempPath);
        const sizeKB = stats.size / 1024;

        console.log(`📦 ${sizeKB.toFixed(1)}KB (target: <${config.targetSizeKB}KB)`);

        if (sizeKB <= config.targetSizeKB) {
            console.log(`✅ Target achieved in ${iteration} attempts`);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            fs.renameSync(tempPath, outputPath);
            return { finalSize: stats.size, iterations: iteration };
        }

        if (iteration >= config.maxIterations) {
            console.log(`⚠️  Could not reach target after ${config.maxIterations} attempts`);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            fs.renameSync(tempPath, outputPath);
            return { finalSize: stats.size, iterations: iteration };
        }

        const oversizeRatio = sizeKB / config.targetSizeKB;

        const newDimensions =
            oversizeRatio > 1.5 && currentWidth > 1200
                ? {
                      width: Math.round(currentWidth * 0.8),
                      height: Math.round(currentHeight * 0.8)
                  }
                : { width: currentWidth, height: currentHeight };

        const qualityReduction = Math.min(15, Math.ceil(oversizeRatio * 8));
        const newQuality = Math.max(35, quality - qualityReduction);

        if (newDimensions.width !== currentWidth || newDimensions.height !== currentHeight) {
            console.log(`📐 Resize: ${newDimensions.width}x${newDimensions.height}px`);
        }
        console.log(`⬇️  Quality: ${newQuality}`);
        return attemptOptimization(newQuality, newDimensions.width, newDimensions.height, iteration + 1);
    };

    return attemptOptimization(config.targetQuality, targetWidth, targetHeight, 1);
};

const generateWebpPaths = (fileObject: any) => {
    const originalNameWithoutExt = fileObject.originalname.replace(/\.[^/.]+$/, '');

    return {
        webpOriginalName: `${originalNameWithoutExt}.webp`,
        webpFilename: `${fileObject.filename.replace(/\.[^/.]+$/, '')}.webp`,
        webpPath: `${fileObject.destination}/${fileObject.filename.replace(/\.[^/.]+$/, '')}.webp`
    };
};

export const convertToWebp = async (fileObject: any, removeMetadata = true) => {
    const startTime = Date.now();
    console.log('🔄 Converting to optimized WebP...');

    try {
        const imagePath = fileObject.path;

        if (!fs.existsSync(imagePath)) {
            logger.error(`File not found: ${imagePath}`);
            return null;
        }

        const originalStats = fs.statSync(imagePath);
        const originalSizeMB = (originalStats.size / (1024 * 1024)).toFixed(2);

        console.log(`📁 Converting: ${fileObject.originalname} (${originalSizeMB}MB)`);

        const image = sharp(imagePath);
        const { format, width, height } = await image.metadata();

        console.log(`🖼️  ${format} ${width}x${height}px → WebP`);

        const webpPaths = generateWebpPaths(fileObject);
        console.log(`🎯 Target: ${webpPaths.webpPath}`);

        const { targetWidth, targetHeight } = calculateTargetDimensions(width!, height!, {
            maxWidth: 1920,
            maxHeight: 1080
        });

        const needsResize = targetWidth !== width || targetHeight !== height;
        if (needsResize) {
            console.log(`📐 Resize: ${width}x${height} → ${targetWidth}x${targetHeight}px`);
        }

        const result = await convertToWebpIterative(imagePath, webpPaths.webpPath, {
            targetWidth,
            targetHeight,
            needsResize,
            removeMetadata,
            targetSizeKB: 200,
            maxIterations: 3,
            startQuality: 70
        });

        if (!result) {
            logger.error(`Failed to create optimized WebP: ${webpPaths.webpPath}`);
            return null;
        }

        const { compressionRatio } = logCompressionResults(originalStats.size, result.finalSize, startTime);

        return {
            fieldname: fileObject.fieldname,
            originalname: webpPaths.webpOriginalName,
            encoding: fileObject.encoding,
            mimetype: 'image/webp',
            destination: fileObject.destination,
            filename: webpPaths.webpFilename,
            path: webpPaths.webpPath,
            size: result.finalSize,
            conversion: {
                originalSize: originalStats.size,
                originalFormat: format,
                compressionRatio,
                sizeReduction: originalStats.size - result.finalSize,
                conversionTime: Date.now() - startTime,
                iterations: result.iterations,
                targetAchieved: result.finalSize / 1024 <= 200
            }
        };
    } catch (error) {
        const totalTime = Date.now() - startTime;
        console.log(`❌ Conversion failed after ${totalTime}ms`);
        console.log('='.repeat(60));
        logger.error(`Failed to convert to WebP: ${error}`);
        return null;
    }
};

const convertToWebpIterative = async (
    inputPath: string,
    outputPath: string,
    options: {
        targetWidth: number;
        targetHeight: number;
        needsResize: boolean;
        removeMetadata: boolean;
        targetSizeKB: number;
        maxIterations: number;
        startQuality: number;
    }
) => {
    const { targetWidth, targetHeight, needsResize, removeMetadata, targetSizeKB, maxIterations, startQuality } = options;

    let quality = startQuality;
    let currentWidth = targetWidth;
    let currentHeight = targetHeight;

    for (let iteration = 1; iteration <= maxIterations; iteration++) {
        console.log(`🔄 Attempt ${iteration}/${maxIterations} (Q:${quality})`);

        try {
            let processedImage = sharp(inputPath);

            if (removeMetadata) {
                processedImage = processedImage.rotate();
            }

            if (needsResize) {
                processedImage = processedImage.resize(currentWidth, currentHeight, {
                    fit: 'inside',
                    withoutEnlargement: true
                });
            }

            await processedImage
                .webp({
                    quality,
                    effort: 6,
                    lossless: false,
                    smartSubsample: true
                })
                .toFile(outputPath);

            const stats = fs.statSync(outputPath);
            const sizeKB = stats.size / 1024;

            console.log(`📦 ${sizeKB.toFixed(1)}KB (target: <${targetSizeKB}KB)`);

            if (sizeKB <= targetSizeKB) {
                console.log(`✅ Target achieved in ${iteration} attempts`);
                return { finalSize: stats.size, iterations: iteration };
            }

            if (iteration < maxIterations) {
                const oversizeRatio = sizeKB / targetSizeKB;

                if (oversizeRatio > 1.5 && currentWidth > 1200) {
                    currentWidth = Math.round(currentWidth * 0.8);
                    currentHeight = Math.round(currentHeight * 0.8);
                    console.log(`📐 Resize: ${currentWidth}x${currentHeight}px`);
                }

                const qualityReduction = Math.min(15, Math.ceil(oversizeRatio * 8));
                quality = Math.max(35, quality - qualityReduction);
                console.log(`⬇️  Quality: ${quality}`);

                if (fs.existsSync(outputPath)) {
                    fs.unlinkSync(outputPath);
                }
            } else {
                console.log(`⚠️  Could not reach target after ${maxIterations} attempts`);
                return { finalSize: stats.size, iterations: iteration };
            }
        } catch (error) {
            console.error(`❌ Error in iteration ${iteration}:`, error);

            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
            }

            if (iteration === maxIterations) {
                throw error;
            }

            quality = Math.max(35, quality - 10);
        }
    }

    return null;
};

export const optimizeWebp = async (fileObject: any, removeMetadata = true) => {
    const startTime = Date.now();

    const config = {
        targetQuality: 80,
        maxWidth: 1920,
        maxHeight: 1080,
        resizeThreshold: 2000,
        targetSizeKB: 200,
        maxIterations: 3
    };

    const imagePath = fileObject.path;

    try {
        if (!fs.existsSync(imagePath)) {
            logger.error(`WebP file not found: ${imagePath}`);
            return null;
        }

        const originalStats = fs.statSync(imagePath);
        const originalSizeKB = (originalStats.size / 1024).toFixed(1);

        console.log(`📁 WebP Optimization: ${fileObject.originalname} (${originalSizeKB}KB)`);

        const image = sharp(imagePath);
        const { format, width, height, channels } = await image.metadata();

        if (format !== 'webp') {
            console.log(`❌ File is not WebP format: ${format}`);
            return null;
        }

        console.log(`📐 ${width}x${height}px, ${channels} channels`);

        const { targetWidth, targetHeight } = calculateTargetDimensions(width!, height!, config);
        const needsResize = targetWidth !== width || targetHeight !== height;

        if (needsResize) {
            console.log(`🎯 Target: ${targetWidth}x${targetHeight}px`);
        }

        const result = await optimizeIteratively(imagePath, imagePath, {
            originalSize: originalStats.size,
            width,
            height,
            targetWidth,
            targetHeight,
            needsResize,
            config,
            removeMetadata
        });

        if (!result) {
            logger.error(`Failed to optimize WebP: ${imagePath}`);
            return null;
        }

        const { compressionRatio } = logCompressionResults(originalStats.size, result.finalSize, startTime);

        return {
            ...fileObject,
            path: imagePath,
            size: result.finalSize,
            optimization: {
                originalSize: originalStats.size,
                optimizedSize: result.finalSize,
                savings: compressionRatio,
                iterations: result.iterations,
                targetAchieved: result.finalSize / 1024 <= config.targetSizeKB,
                processingTime: Date.now() - startTime
            }
        };
    } catch (error) {
        logger.error(`Failed to optimize WebP: ${error}`);
        return null;
    }
};

export const isImageMimetype = (mimetype: string): boolean => {
    return mimetype.startsWith('image/') && !mimetype.includes('svg');
};

export const getProcessedFilename = (originalFilename: string, width?: string, height?: string, quality?: string): string => {
    const nameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
    const params = [];

    if (width) params.push(`w${width}`);
    if (height) params.push(`h${height}`);
    if (quality) params.push(`q${quality}`);

    const suffix = params.length > 0 ? `_${params.join('_')}` : '';
    return `${nameWithoutExt}${suffix}.webp`;
};
