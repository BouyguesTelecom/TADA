import { findFileInCatalog } from '../../../utils/catalog';
import { MissingParamsProps, NamespaceProps } from './props';
import fetch from 'node-fetch';

export const purgeData = async (data) => {
    if (data === 'catalog') {
        await fetch(`${process.env.NGINX_SERVICE}/purge${process.env.API_PREFIX}/catalog`);
    }
    if (data && data.length && typeof data[0] === 'object') {
        for (const file of data) {
            await fetch(`${process.env.NGINX_SERVICE}/purge${process.env.API_PREFIX}/assets/media/original/image${file.unique_name}`);
            await fetch(`${process.env.NGINX_SERVICE}/purge${process.env.API_PREFIX}/assets/media/full/image${file.unique_name}`);
        }
    }
};

export const sendResponse = async ({ res, status, data = null, errors = null, purge = 'false' }) => {
    if (purge) {
        await purgeData(purge === 'catalog' ? 'catalog' : data);
    }
    return res.status(status).json({ data, errors }).end();
};

export const checkNamespace = ({ namespace }: NamespaceProps): boolean => {
    if (!process.env.NAMESPACES?.split(',').includes(namespace)) {
        return false;
    }
    return true;
};

export const checkMissingParam = ({ requiredParams, params }: MissingParamsProps) => {
    const errors = [];
    for (const param of requiredParams) {
        if (!params.hasOwnProperty(param)) {
            errors.push(`${param} is required`);
        }
    }
    return errors;
};

export const generateUniqueName = (file, body, namespace, toWebp) => {
    return (
        file &&
        `/${namespace}/${body.destination ? `${body.destination}/` : ''}${toWebp && ['image/jpeg', 'image/png'].includes(file.mimetype) ? file.filename.split('.')[0] + '.webp' : file.filename}`
    );
};

export const fileIsTooLarge = async (file, params, method = 'POST') => {
    const { uuid, namespace } = params;
    if (file) {
        if (file.size > 10000000) {
            const itemFound = method === 'PATCH' && (await findFileInCatalog(uuid, 'uuid'));
            return {
                filename: file.filename,
                size: file.size,
                message: 'File too large: can not exceeded 10mb',
                ...itemFound
            };
        }
    }
    return null;
};
