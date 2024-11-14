import { logger } from './logs/winston';

const callAPI = async (url: string, method: string, data?: any, isMultipart: boolean = false) => {
    try {
        logger.log('jobInfo', `Making a ${method} request to ${url}`);

        let headers: HeadersInit = {};
        let body: BodyInit | null = null;

        if (isMultipart && data) {
            const formData = new FormData();
            for (const key in data) {
                if (Object.prototype.hasOwnProperty.call(data, key)) {
                    formData.append(key, data[key]);
                }
            }
            body = formData;
        } else if (data) {
            body = JSON.stringify(data);
            headers = {
                'Content-Type': 'application/json'
            };
        }

        const options: RequestInit = { method, headers, body };

        if (body) {
            logger.debug(`Request body: ${body}`);
        }

        const response = await fetch(url, options);
        const responseBody = await response.text();

        if (!response.ok) {
            logger.log('jobError', `Error calling API ${method} ${url}: ${response.statusText}`);
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        return responseBody ? JSON.parse(responseBody) : null;
    } catch (error) {
        logger.log('jobError', `Error: ${error.message}`);
        throw error;
    }
};

export const processCatalog = async () => {
    try {
        const apiServiceURL = process.env.API_PREFIX ? process.env.API_SERVICE + process.env.API_PREFIX : process.env.API_SERVICE!;
        const catalogRoute = process.env.CATALOG_ROUTE!;
        const imageServiceURL = process.env.IMAGE_SERVICE!;
        const itemDeletionLog: string[] = [];

        const files = await callAPI(`${apiServiceURL}${catalogRoute}`, 'GET');

        for (const file of files) {
            const currentDate = new Date();
            const expirationDate = file.expiration_date ? new Date(file.expiration_date) : null;
            logger.log('jobInfo', `Processing file ${file.uuid}, expiration date: ${expirationDate}`);

            if (expirationDate && expirationDate <= currentDate && file.expired === false) {
                const patchData = {
                    expired: 'true',
                    namespace: file.namespace
                };

                const patchUrl = `${apiServiceURL}${process.env.PATCH_ROUTE}/${file.uuid}`;
                logger.log('jobInfo', `Making a PATCH request to ${patchUrl} with data: ${JSON.stringify(patchData)}`);

                // multipart/form-data for PATCH
                await callAPI(patchUrl, 'PATCH', patchData, true);
                logger.log('jobInfo', `File ${file.uuid} marked as expired.`);
            }
        }

        // Fetch the catalog again to get the updated status
        const updatedFiles = await callAPI(`${apiServiceURL}${catalogRoute}`, 'GET');

        // Second pass: process deletions for expired items and items not found in PV
        for (const file of updatedFiles) {
            logger.log('jobInfo', `Checking file ${file.uuid}, expired status: ${file.expired}`);

            if (file.expired === 'true') {
                const fullUrl = `${imageServiceURL}${process.env.GET_ROUTE}${file.unique_name}`;
                logger.log('jobInfo', `Checking file existence at: ${fullUrl}`);

                try {
                    const response = await fetch(fullUrl);
                    if (response.status === 200) {
                        logger.log('jobInfo', `File exists in PV: ${file.unique_name}`);
                    } else if (response.status === 404) {
                        // If the file gets a 404, store the item for later deletion
                        logger.log('jobInfo', `File not found in PV: ${file.unique_name}, adding to deletion log.`);
                        itemDeletionLog.push(file.uuid);
                    }
                } catch (error) {
                    logger.log('jobError', `Error checking file ${file.unique_name}: ${error.message}`);
                }
            }
        }

        // Process deletions for items in the deletion log
        for (const uuid of itemDeletionLog) {
            const file = updatedFiles.find((f) => f.uuid === uuid);
            if (file) {
                const deleteUrl = `${apiServiceURL}${process.env.DELETE_ROUTE}/${uuid}`;

                logger.log('jobInfo', `Making a DELETE request to ${deleteUrl} for file ${file.uuid}`);

                await callAPI(deleteUrl, 'DELETE', {
                    namespace: file.namespace
                });
                logger.log('jobInfo', `File ${file.uuid} expired and deleted from PV and backup.`);
            }
        }

        // Final fetch to confirm deletions
        const finalCatalog = await callAPI(`${apiServiceURL}${catalogRoute}`, 'GET');
        logger.log('jobInfo', `Final catalog: ${finalCatalog}`);
        const remainingItems = itemDeletionLog.filter((uuid) => !finalCatalog.some((file) => file.uuid === uuid));

        if (remainingItems.length === 0) {
            logger.log('jobInfo', 'All expired and 404 items have been successfully removed from the catalog.');
        } else {
            logger.log('jobWarning', `Some items are still present in the catalog: ${remainingItems.join(', ')}`);
        }

        // Create a dump of the DB
        logger.log('jobInfo', 'Creating a dump of the DB...');
        await callAPI(`${apiServiceURL}${catalogRoute}/create-dump`, 'GET');
        logger.log('jobInfo', 'Database dump created successfully.');
    } catch (error) {
        logger.log('jobError', `Error in processCatalog: ${error.message}`);
    }
};
