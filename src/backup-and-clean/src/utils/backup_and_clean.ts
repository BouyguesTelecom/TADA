import { logger } from '../utils/logs/winston';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';
type HeadersInit = {
    'Content-Type'?: string;
};

export async function callAPI(url: string, method: HttpMethod, data?: object, isMultipart: boolean = false) {
    try {
        logger.info(`Making a ${method} request to ${url}`);

        const headers: HeadersInit = {};
        let body: BodyInit | null = null;

        // create-dump
        if (url.includes('/catalog/create-dump') && method === 'POST') {
            logger.info('Special handling for catalog dump creation');
        } else if (isMultipart && data) {
            const formData = new FormData();
            Object.entries(data).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    if (typeof value === 'object' && value !== null && !(value instanceof Blob)) {
                        formData.append(key, JSON.stringify(value));
                    } else {
                        formData.append(key, value as any);
                    }
                }
            });
            body = formData;
        } else if (data) {
            body = JSON.stringify(data);
            headers['Content-Type'] = 'application/json';
        }

        if (process.env.API_TOKEN) {
            headers['Authorization'] = `Bearer ${process.env.API_TOKEN}`;
        }

        const options: RequestInit = { method, headers, body };

        if (body) {
            logger.debug(`Request has body: ${body instanceof FormData ? '[FormData]' : body}`);
        }

        const response = await fetch(url, options);

        let responseBody;
        try {
            responseBody = await response.text();
        } catch (err) {
            logger.warn(`Cannot read response body: ${err.message}`);
            responseBody = '';
        }

        if (!response.ok) {
            logger.error(`Error calling API ${method} ${url}: ${response.status} ${response.statusText}`);
            logger.error(`Response body: ${responseBody.substring(0, 500)}${responseBody.length > 500 ? '...' : ''}`);
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        try {
            return responseBody ? JSON.parse(responseBody) : null;
        } catch (parseError) {
            logger.warn(`Response is not valid JSON, returning text: ${responseBody.substring(0, 100)}...`);
            return responseBody;
        }
    } catch (error) {
        logger.error(`Error in API call to ${url}: ${(error as Error).message}`);
        throw error;
    }
}

interface File {
    uuid: string;
    expiration_date: string | null;
    expired: boolean | string;
    namespace: string;
    unique_name: string;
}

const processFiles = async (files: File[], apiServiceURL: string, nginxServiceURL: string) => {
    const itemDeletionLog: string[] = [];

    const updatedFiles = await Promise.all(
        files.map(async (file) => {
            const currentDate = new Date();
            const expirationDate = file.expiration_date ? new Date(file.expiration_date) : null;

            if (expirationDate && expirationDate <= currentDate && file.expired === false) {
                const patchData = { expired: 'true', namespace: file.namespace };
                const patchUrl = `${apiServiceURL}/file/${file.uuid}`;
                logger.info(`Making a PATCH request to ${patchUrl} with data: ${JSON.stringify(patchData)}`);
                await callAPI(patchUrl, 'PATCH', patchData, true);
                logger.info(`File ${file.uuid} marked as expired.`);
                file.expired = 'true';
            }

            if (file.expired === 'true') {
                const fullUrl = `${nginxServiceURL}${file.unique_name}`;
                logger.info(`Checking file existence at: ${fullUrl}`);
                try {
                    const response = await fetch(fullUrl);
                    if (response.status === 404) {
                        logger.info(`File not found in PV: ${file.unique_name}, adding to deletion log.`);
                        itemDeletionLog.push(file.uuid);
                    }
                } catch (error) {
                    logger.info(`Error checking file ${file.unique_name}: ${(error as Error).message}`);
                }
            }

            return file;
        })
    );

    return { updatedFiles, itemDeletionLog };
};

const deleteFilesFromCatalog = async (itemDeletionLog: string[], files: File[], apiServiceURL: string) => {
    await Promise.all(
        itemDeletionLog.map(async (uuid) => {
            const file = files.find((f) => f.uuid === uuid);
            if (file) {
                const deleteUrl = `${apiServiceURL}/file/${uuid}`;
                logger.info(`Making a DELETE request to ${deleteUrl} for file ${file.uuid}`);
                await callAPI(deleteUrl, 'DELETE', { namespace: file.namespace });
                logger.info(`File ${file.uuid} expired and deleted from PV and backup.`);
            }
        })
    );

    return files.filter((file) => !itemDeletionLog.includes(file.uuid));
};

export const processCatalog = async () => {
    try {
        const apiServiceURL = process.env.API_PREFIX ? `${process.env.API_SERVICE}${process.env.API_PREFIX}` : process.env.API_SERVICE!;
        const catalogRoute = process.env.CATALOG_ROUTE!;
        const nginxServiceURL = process.env.NGINX_SERVICE!;
        const apiToken = process.env.API_TOKEN;

        if (!apiToken) {
            logger.warn('No API token provided. Authentication might fail for secured endpoints.');
        }

        logger.info(`Fetching catalog from ${apiServiceURL}${catalogRoute}`);
        const files: File[] = await callAPI(`${apiServiceURL}${catalogRoute}`, 'GET');

        const { updatedFiles, itemDeletionLog } = await processFiles(files, apiServiceURL, nginxServiceURL);
        const remainingFiles = await deleteFilesFromCatalog(itemDeletionLog, updatedFiles, apiServiceURL);
        const remainingItems = itemDeletionLog.filter((uuid) => remainingFiles.some((file) => file.uuid === uuid));

        if (remainingItems.length === 0) {
            logger.info('All expired and 404 items have been successfully removed from the catalog.');
        } else {
            logger.info(`Some items are still present in the catalog: ${remainingItems.join(', ')}`);
        }

        logger.info('Creating a dump of the catalog after cleanup...');
        const dumpUrl = `${apiServiceURL}${catalogRoute}/create-dump`;
        logger.info(`Calling dump creation endpoint: ${dumpUrl}`);

        try {
            await callAPI(dumpUrl, 'POST');
            logger.info('Database dump created successfully.');
        } catch (dumpError) {
            logger.error(`Failed to create catalog dump: ${(dumpError as Error).message}`);
        }
    } catch (error) {
        logger.error(`Error in processCatalog: ${(error as Error).message}`);
        logger.error(`Error stack: ${(error as Error).stack}`);
    }
};
