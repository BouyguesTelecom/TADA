import { logger } from '../utils/logs/winston';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';
type HeadersInit = {
    'Content-Type'?: string;
};

export async function callAPI(url: string, method: HttpMethod, data?: object, isMultipart: boolean = false) {
    console.log(`callAPI invoked with url: ${url}, method: ${method}, isMultipart: ${isMultipart}`);
    try {
        logger.info(`Making a ${method} request to ${url}`);

        const headers: HeadersInit = {};
        let body: BodyInit | null = null;

        if (isMultipart && data) {
            console.log('Preparing multipart form data');
            const formData = new FormData();
            Object.keys(data).forEach((key) => {
                formData.append(key, data[key as keyof typeof data] as any);
            });
            body = formData;
        } else if (data) {
            console.log('Preparing JSON body');
            body = JSON.stringify(data);
            headers['Content-Type'] = 'application/json';
        }

        const options: RequestInit = { method, headers, body };

        if (body) {
            logger.debug(`Request body: ${body}`);
            console.log(`Request body prepared: ${body}`);
        }

        console.log(`Sending request to ${url} with options:`, options);
        const response = await fetch(url, options);
        const responseBody = await response.text();

        console.log(`Response received with status: ${response.status}`);
        if (!response.ok) {
            logger.info(`Error calling API ${method} ${url}: ${response.statusText}`);
            console.log(`API call failed with status: ${response.status}, statusText: ${response.statusText}`);
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        console.log('API call successful, parsing response body');
        return responseBody ? JSON.parse(responseBody) : null;
    } catch (error) {
        logger.info(`Error: ${(error as Error).message}`);
        console.log(`Error occurred in callAPI: ${(error as Error).message}`);
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
        const apiServiceURL = process.env.IMAGE_SERVICE!;
        const catalogRoute = process.env.CATALOG_ROUTE!;
        const nginxServiceURL = process.env.NGINX_SERVICE!;

        const files: File[] = await callAPI(`${apiServiceURL}${catalogRoute}`, 'GET');

        const { updatedFiles, itemDeletionLog } = await processFiles(files, apiServiceURL, nginxServiceURL);

        const remainingFiles = await deleteFilesFromCatalog(itemDeletionLog, updatedFiles, apiServiceURL);

        const remainingItems = itemDeletionLog.filter((uuid) => remainingFiles.some((file) => file.uuid === uuid));

        if (remainingItems.length === 0) {
            logger.info('All expired and 404 items have been successfully removed from the catalog.');
        } else {
            logger.info(`Some items are still present in the catalog: ${remainingItems.join(', ')}`);
        }

        const dumpUrl = `${apiServiceURL}${catalogRoute}/create-dump`;
        logger.info(`Triggering catalog dump via POST ${dumpUrl}`);
        await callAPI(dumpUrl, 'POST');
        logger.info('Database dump created successfully.');
    } catch (error) {
        logger.info(`Error in processCatalog: ${(error as Error).message}`);
    }
};
