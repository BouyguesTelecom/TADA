import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { logger } from './logs/winston';

require('dotenv').config();

const removeUnusedData = (svgFilePath) => {
    // Read SVG
    const svgData = fs.readFileSync(svgFilePath, 'utf8');

    // Delete <?xml ?>
    const xmlDeclarationRegex = /<\?xml[\s\S]*?\?>/g;
    const cleanedSvgData = svgData.replace(xmlDeclarationRegex, '');

    // Delete <!DOCTYPE>
    const doctypeRegex = /<!DOCTYPE[\s\S]*?>/g;
    const cleanedSvgData2 = cleanedSvgData.replace(doctypeRegex, '');

    // Delete metadata
    const metadataRegex = /<metadata>[\s\S]*?<\/metadata>/g;
    const cleanedSvgData3 = cleanedSvgData2.replace(metadataRegex, '');

    // Delete unused attributes
    const elementsToRemove = ['title', 'desc', 'defs'];
    const elementRegex = new RegExp(`<(${elementsToRemove.join('|')})>[\\s\\S]*?<\/\\1>`, 'g');
    const cleanedSvgData4 = cleanedSvgData3.replace(elementRegex, '');

    // Delete comments
    const commentRegex = /<!--[\s\S]*?>/g;
    const cleanedSvgData5 = cleanedSvgData4.replace(commentRegex, '');

    return cleanedSvgData5;
};

const removeMetadataPdf = async (imagePath) => {
    try {
        const data = await fs.promises.readFile(imagePath);
        const pdfDoc = await PDFDocument.load(data);
        pdfDoc.setAuthor('');
        pdfDoc.setProducer('');
        pdfDoc.setCreator('');

        logger.info('Metadata removed successfully');
        return await pdfDoc.save();
    } catch (errorMessage: any) {
        logger.error(`Failed to remove metadata: ${errorMessage}`);
        return false;
    }
};

const removeMetadataImage = async (imagePath) => {
    try {
        const config = {
            jpeg: {
                progressive: true,
                force: false,
                quality: 100
            },
            webp: { quality: 100, force: false },
            png: { force: false }
        };
        const image = sharp(imagePath);
        const { format } = await image.metadata();

        return await image[format](config[format]).rotate().toBuffer();
    } catch (errorMessage) {
        logger.error(`Failed to remove metadata ${errorMessage}`);
        return false;
    }
};
const convertToWebp = async (imagePath) => {
    try {
        const config = {
            jpeg: {
                progressive: true,
                force: false,
                quality: 100
            },
            webp: { quality: 100, force: false },
            png: { force: false }
        };
        const image = sharp(imagePath).withMetadata();
        const { format } = await image.metadata();
        const webpPath = '/tmp/' + 'webp-' + imagePath.split('/tmp/')[1].split('.')[0] + '.webp';
        await image[format](config[format]).rotate().toFormat('webp').toFile(webpPath);
        return webpPath;
    } catch (errorMessage) {
        logger.error(`Failed to remove metadata ${errorMessage}`);
        return '';
    }
};

export const convertToWebpBuffer = async (buffer: Buffer, params = null, type = null) => {
    try {
        const config = {
            jpeg: {
                progressive: true,
                force: false,
                quality: 80
            },
            webp: { quality: 100, force: false },
            png: { force: false }
        };
        const image = sharp(buffer).withMetadata();
        const { format } = await image.metadata();
        if (params) {
            const { width, height } = params;
            if (width || height) {
                return await image[format](config[format])
                    .resize(width !== 0 ? width : null, height !== 0 ? height : null)
                    .toFormat('webp')
                    .toBuffer();
            }
        }

        return await image[format](config[format]).rotate().toFormat('webp').toBuffer();
    } catch (errorMessage) {
        logger.error(`Failed to remove metadata ${errorMessage}`);
        return '';
    }
};

const sharpWithMetadata = async (imagePath) => {
    try {
        const config = {
            jpeg: {
                progressive: true,
                force: false,
                quality: 100
            },
            webp: { quality: 100, force: false },
            png: { force: false }
        };
        const image = sharp(imagePath).withMetadata();
        const { format } = await image.metadata();

        return await image[format](config[format]).rotate().toFormat(format).toBuffer();
    } catch (errorMessage) {
        logger.error(`Failed to remove metadata ${errorMessage}`);
        return '';
    }
};

export const stripMetadata = async (imageBuffer: Buffer, finalPath: string, mimetype: string) => {
    try {
        const image = sharp(imageBuffer);
        const metadata = await image.metadata();

        if (!metadata.format) {
            throw new Error('Unsupported image format');
        }

        const config = {
            jpeg: {
                quality: 100,
                progressive: true
            },
            png: {
                quality: 100,
                compressionLevel: 9
            },
            webp: {
                quality: 100
            }
        };

        switch (metadata.format) {
            case 'jpeg':
            case 'jpg':
                return await image.jpeg(config.jpeg).toBuffer();
            case 'png':
                return await image.png(config.png).toBuffer();
            case 'webp':
                return await image.webp(config.webp).toBuffer();
            default:
                throw new Error(`Unsupported image format: ${metadata.format}`);
        }
    } catch (error) {
        logger.error(`Failed to remove metadata: ${error}`);
        throw error;
    }
};

export const deleteFile = (filePath): Promise<boolean> => {
    return fs.promises
        .unlink(filePath)
        .then(() => true)
        .catch(() => false);
};

export const generateStream = async (file: any, uniqueName: string, toWebpConversion: boolean): Promise<any> => {
    const toWebp = toWebpConversion && ['image/png', 'image/jpeg'].includes(file.mimetype);
    if (process.env.USE_STRIPMETADATA === 'true') {
        if (toWebp) {
            const webpPath = await convertToWebp(file.path);
            const streamWithoutMetadata = await stripMetadata(Buffer.from(webpPath, 'utf8'), uniqueName, file.mimetype);
            await deleteFile(file.path);
            await deleteFile(webpPath);
            return streamWithoutMetadata;
        }
        const streamWithoutMetadata = await stripMetadata(Buffer.from(file.path, 'utf8'), uniqueName, file.mimetype);
        await deleteFile(file.path);
        return streamWithoutMetadata;
    }
    const streamWithMetadata = ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype) ? await sharpWithMetadata(file.path) : fs.promises.readFile(file.path);
    await deleteFile(file.path);
    return streamWithMetadata;
};
