import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import path from 'path';
import app from '../app';
import { getCatalog } from '../catalog';
import { FileProps } from '../props/catalog';
import { getCachedCatalog } from '../catalog/redis/connection';

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

    return `${ year }${ month }${ day }T${ hours }${ minutes }${ seconds }`;
};

export const isExpired = (itemBody: FileProps): boolean => {
    const currentDate = Date.now();
    const dateToCompare = itemBody.expiration_date && new Date(itemBody.expiration_date).getTime();
    const expired = itemBody.expired === true || ( dateToCompare && !isNaN(dateToCompare) && dateToCompare <= currentDate );
    return expired;
};


function getDestinationPath(finalPath, namespace) {
    const destinationWithLeadingSlash = path.dirname(finalPath);

    const destination = destinationWithLeadingSlash.startsWith('/') ?
        destinationWithLeadingSlash.slice(1) :
        destinationWithLeadingSlash;

    return destination.split(`${ namespace }/`)[1];
}

export const formatItemForCatalog = async (
    fileInfo: Object,
    resourceName: string,
    namespace: string,
    uniqueName: string,
    folderPath: string | null,
    mimetype: string,
    toWebp: boolean,
    signature: string,
    size: string
) => {
    const newUUID = crypto.createHash('md5').update(uniqueName).digest('hex');
    console.log(mimetype, 'MIMETYPE ICI 🔥');
    return {
        uuid: newUUID,
        version: 1,
        namespace,
        public_url: `${ process.env.NGINX_INGRESS }${ app.locals.PREFIXED_ASSETS_URL }/${ mimetype === 'application/pdf' || mimetype === 'image/svg+xml' ?
            'original' :
            'full' }${ uniqueName }`,
        unique_name: uniqueName,
        filename: toWebp && [ 'image/jpeg', 'image/png' ].includes(mimetype) ?
            resourceName.split('.')[0] + '.webp' :
            resourceName,
        original_filename: resourceName,
        base_host: process.env.NGINX_INGRESS,
        base_url: `${ app.locals.PREFIXED_ASSETS_URL }/${ mimetype === 'application/pdf' || mimetype === 'image/svg+xml' ? 'original' : 'full' }`,
        external_id: null,
        expired: false,
        expiration_date: null,
        information: null,
        original_mimetype: mimetype,
        mimetype: toWebp && [ 'image/jpeg', 'image/png' ].includes(mimetype) ? 'image/webp' : mimetype,
        signature: signature,
        ...( fileInfo && { ...fileInfo } ),
        destination: getDestinationPath(uniqueName, namespace),
        size
    };
};

