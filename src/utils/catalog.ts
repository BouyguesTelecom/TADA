import crypto from 'crypto';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import app from '../api/app';
import { IFile } from '../core/interfaces/Ifile';
import { CatalogService } from '../core/services/catalog.service';

const catalogService = new CatalogService();

export const calculateSHA256 = (buffer: Buffer) => {
    return crypto.createHash('sha256').update(buffer).digest('hex');
};

export const isExpired = (itemBody: IFile): boolean => {
    const currentDate = Date.now();
    const dateToCompare = itemBody.expiration_date && new Date(itemBody.expiration_date).getTime();
    const expired = itemBody.expired === true || (dateToCompare && !isNaN(dateToCompare) && dateToCompare <= currentDate);
    return expired || false;
};

export const _generateUniqueUUIDcatalog = async () => {
    let myuuid = uuidv4();
    while ((await findFileInCatalog(myuuid, 'uuid')) !== undefined) {
        myuuid = uuidv4();
    }
    return myuuid;
};

function getDestinationPath(finalPath, namespace) {
    const destinationWithLeadingSlash = path.dirname(finalPath);

    const destination = destinationWithLeadingSlash.startsWith('/') ? destinationWithLeadingSlash.slice(1) : destinationWithLeadingSlash;

    return destination.split(`${namespace}/`)[1];
}

export const formatItemForCatalog = async (
    fileInfo: Object,
    resourceName: string,
    namespace: string,
    finalPath: string,
    folderPath: string | null,
    mimetype: string,
    toWebp: boolean,
    signature: string,
    size: string
) => {
    const newUUID = await _generateUniqueUUIDcatalog();

    return {
        uuid: newUUID,
        version: 1,
        namespace,
        public_url: `${process.env.NGINX_INGRESS}${app.locals.PREFIXED_ASSETS_URL}/${mimetype === 'application/pdf' || mimetype === 'image/svg+xml' ? 'original' : 'full'}${finalPath}`,
        unique_name: finalPath,
        filename: toWebp && ['image/jpeg', 'image/png'].includes(mimetype) ? resourceName.split('.')[0] + '.webp' : resourceName,
        original_filename: resourceName,
        base_host: process.env.NGINX_INGRESS,
        base_url: app.locals.PREFIXED_ASSETS_URL,
        external_id: null,
        expired: false,
        expiration_date: null,
        information: null,
        original_mimetype: mimetype,
        mimetype: toWebp && ['image/jpeg', 'image/png'].includes(mimetype) ? 'image/webp' : mimetype,
        signature: signature,
        ...(fileInfo && { ...fileInfo }),
        destination: getDestinationPath(finalPath, namespace),
        size
    };
};

export const findFileInCatalog = async (key_value: string, key_name: string) => {
    const { data: catalog } = await catalogService.getFiles();
    const isUnique = catalog && catalog.filter((item) => item[`${key_name}`] === key_value).length === 1;
    return isUnique ? catalog.find((item) => item[`${key_name}`] === key_value) : undefined;
};
