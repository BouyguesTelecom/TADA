import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { logger } from './logs/winston';
import sharp from 'sharp';
import path from 'path';
import { convertToWebp, optimizeWebp } from './imageOptimization';

require('dotenv').config();

export const returnDefaultImage = (res, uniqueName) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    const rootPath = process.env.NODE_ENV !== 'production' ? path.resolve(__dirname, '../images') : '/tmp/images';

    return res.sendFile(uniqueName, { root: rootPath });
};

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
        const image = sharp(imagePath);
        return await image.rotate().toBuffer();
    } catch (errorMessage) {
        logger.error(`Failed to remove metadata ${errorMessage}`);
        return false;
    }
};

export const stripMetadata = async (imagePath: string, mimetype: string) => {
    switch (mimetype) {
        case 'application/pdf':
            const pdfUint8Array = await removeMetadataPdf(imagePath);
            return Buffer.from(pdfUint8Array as Uint8Array);
        case 'image/jpeg':
        case 'image/webp':
        case 'image/png':
            return await removeMetadataImage(imagePath);
        case 'image/svg+xml':
            return removeUnusedData(imagePath);
        default:
            return;
    }

    return false;
};

export const deleteFile = async (filePath): Promise<boolean> => {
    try {
        await fs.promises.unlink(filePath);
        logger.info(`File deleted: ${filePath}`);

        let currentDir = path.dirname(filePath);

        while (currentDir !== path.resolve('tmp/files')) {
            const files = await fs.promises.readdir(currentDir);

            if (files.length === 0) {
                await fs.promises.rmdir(currentDir);
                logger.info(`Directory deleted: ${currentDir}`);
                currentDir = path.dirname(currentDir);
            } else {
                break;
            }
        }

        return true;
    } catch (error) {
        console.error(`Error: ${error}`);
        return false;
    }
};

export const generateStream = async (file: any, toWebpConversion: boolean, original = false): Promise<any> => {
    const toWebp = toWebpConversion && ['image/png', 'image/jpeg'].includes(file.mimetype);
    if (original) {
        const streamWithMetadata = fs.readFileSync(file.path);
        return { stream: streamWithMetadata, file };
    }

    if (toWebp) {
        const newFile = await convertToWebp(file, process.env.USE_STRIPMETADATA === 'true');
        const stream = fs.readFileSync(newFile.path);
        return { stream: stream, file: newFile };
    }
    if(process.env.COMPRESS_WEBP && toWebp){
        const newFile = await optimizeWebp(file, process.env.USE_STRIPMETADATA === 'true')
        const compressedStream = fs.readFileSync(newFile.path)
        return { stream: compressedStream, file: newFile };
    }

    if (process.env.USE_STRIPMETADATA === 'true') {
        const streamWithoutMetadata = await stripMetadata(file.path, file.mimetype);
        return { stream: streamWithoutMetadata, file };
    }
    const streamWithMetadata = fs.readFileSync(file.path);
    return { stream: streamWithMetadata, file };
};
