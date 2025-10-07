import crypto from 'crypto';
import path from 'path';
import app from '../app';
import { FileProps } from '../props/catalog';

export const calculateSHA256 = (buffer: Buffer) => {
    return crypto.createHash('sha256').update(buffer).digest('hex');
};

export const getCurrentDateVersion = (): string => {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}T${hours}${minutes}${seconds}`;
};

export const isExpired = (itemBody: FileProps): boolean => {
    const currentDate = Date.now();
    const dateToCompare = itemBody.expiration_date && new Date(itemBody.expiration_date).getTime();
    const expired = itemBody.expired === true || (dateToCompare && !isNaN(dateToCompare) && dateToCompare <= currentDate);
    return expired;
};

const getDestinationPath = (finalPath, namespace) => {
    const destinationWithLeadingSlash = path.dirname(finalPath);

    const destination = destinationWithLeadingSlash.startsWith('/') ? destinationWithLeadingSlash.slice(1) : destinationWithLeadingSlash;

    const splitResult = destination.split(`${namespace}/`);
    if (splitResult.length < 2) {
        return destination.replace(/[^a-zA-Z0-9/@\-%_]+/g, '_');
    }
    return splitResult[1].replace(/[^a-zA-Z0-9/@\-%_]+/g, '_');
}

export const formatItemForCatalog = async (
    fileInfo: Object,
    originalFile?: any,
    transformedFile?: any
) => {
    const {unique_name, namespace, mimetype, size, filename, signature } = transformedFile;
    const {mimetype: original_mimetype, size: original_size, filename: original_filename, signature: original_signature } = originalFile;
    const newUUID = crypto.createHash('md5').update(unique_name).digest('hex');
    const publicUrl = process.env.PUBLIC_URL || 'http://localhost:3001';
    const baseUrl = app.locals.PREFIXED_ASSETS_URL || '/assets';
    
    if (!process.env.PUBLIC_URL) {
        console.warn(`⚠️  PUBLIC_URL not set, using fallback: ${publicUrl}`);
    }
    const mimeTypeRequiredOriginalUrl = ['application/pdf', 'image/svg+xml']
    const accessUrl = `${publicUrl}${baseUrl}/${mimeTypeRequiredOriginalUrl.includes(transformedFile.mimetype) ? 'original' : 'full'}${unique_name}`
    return {
        uuid: newUUID,
        version: 1,
        namespace,
        public_url: accessUrl,
        unique_name,
        filename,
        original_filename,
        base_host: publicUrl,
        base_url: baseUrl,
        external_id: null,
        expired: false,
        expiration_date: null,
        information: null,
        original_mimetype,
        mimetype,
        signature,
        destination: getDestinationPath(unique_name, namespace),
        size,
        original_size,
        uploaded_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
        original_signature,
        original_version: 1,
        ...(fileInfo && { ...fileInfo }),
    };
};
