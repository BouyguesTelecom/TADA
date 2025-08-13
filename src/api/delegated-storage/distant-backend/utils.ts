import FormData from 'form-data';
import fs from 'fs';
import fetch from 'node-fetch';
import { addCatalogItems, getCatalog, updateCatalogItem } from '../../catalog';
import { initializeCache, redisHandler } from '../../catalog/redis/connection';
import { BackupProps } from '../../props/delegated-storage';
import { logger } from '../../utils/logs/winston';
import { FileProps, ResponseBackup } from '../types';
import { getCurrentDateVersion } from '../../utils/catalog';

export const headersUserAgentForBackup = (contentType: string | null = null) =>
    new Headers({
        ...(process.env.DELEGATED_STORAGE_TOKEN && {
            Authorization: `Bearer ${process.env.DELEGATED_STORAGE_TOKEN}`
        }),
        ...(contentType && { 'Content-Type': contentType })
    });

const generateOptions: any = (method, contentTypeHeaders, body = null) => {
    return {
        method: method,
        headers: headersUserAgentForBackup(contentTypeHeaders),
        redirect: 'follow',
        ...(body && { body })
    };
};

const generateUrl: any = (pathType = 'SINGLE') => {
    const delegatedStoragePath = pathType === 'SINGLE' ? (process.env.DELEGATED_STORAGE_SINGLE_PATH ?? '') : (process.env.DELEGATED_STORAGE_MULTI_PATH ?? '');
    return `${process.env.DELEGATED_STORAGE_HOST}${delegatedStoragePath}`;
};

const generateFormDataWithFile = (stream, file, info) => {
    const form = new FormData();
    for (const key in info) {
        if (info.hasOwnProperty(key) && info[key]) {
            form.append(key, info[key]);
        }
    }
    form.append('file', stream, file);
    return form;
};

export const getDump = async (filename = null, format = 'rdb') => {
    try {
        let dumpUrl: string;

        if (filename) {
            dumpUrl = `${process.env.DELEGATED_STORAGE_HOST}${process.env.URL_TO_GET_BACKUP}/${encodeURIComponent(filename)}`;
        } else {
            const formatQuery = format === 'json' ? '?format=json' : '';
            dumpUrl = `${process.env.DELEGATED_STORAGE_HOST}/get-dump/latest${formatQuery}`;
        }

        logger.info(`Fetching dump from: ${dumpUrl} (format: ${format})`);
        const response = await fetch(dumpUrl, generateOptions('GET', 'application/json'));

        if (response.status !== 200) {
            return {
                status: response.status,
                data: [],
                errors: [`Failed to get dump file: ${response.statusText}`]
            };
        }

        const contentType = response.headers.get('content-type');
        const actualFormat = response.headers.get('x-actual-format');
        const requestedFormat = response.headers.get('x-requested-format');

        const isJsonResponse =
            actualFormat === 'JSON' || (contentType?.includes('application/json') && !actualFormat) || (format === 'json' && !actualFormat && !contentType?.includes('octet-stream'));

        logger.info(`Response - Content-Type: ${contentType}, Requested: ${requestedFormat}, Actual: ${actualFormat}, Treating as: ${isJsonResponse ? 'JSON' : 'RDB'}`);

        if (isJsonResponse) {
            const jsonData = await response.json();
            return {
                status: 200,
                data: [JSON.stringify(jsonData, null, 2)],
                errors: []
            };
        } else {
            const buffer = await response.buffer();
            return {
                status: 200,
                data: [buffer.toString('base64')],
                errors: []
            };
        }
    } catch (errMessage) {
        logger.error(`Error getting dump: ${errMessage}`);
        return {
            status: 500,
            data: [],
            errors: [errMessage.message || errMessage.toString()]
        };
    }
};

export const createDump = async (filePath, fileFormat) => {
    const results = [];
    const backupUrl = `${process.env.DELEGATED_STORAGE_HOST}${process.env.URL_TO_POST_BACKUP}`;

    const timestamp = getCurrentDateVersion();

    const baseName = filePath ? filePath.replace(/\.(rdb|json)$/, '') : `dump_${timestamp}`;

    if (fileFormat === 'rdb' || fileFormat === 'both') {
        try {
            await redisHandler.generateDump();
            const dumpPath = process.env.DUMP_FOLDER_PATH ? `${process.env.DUMP_FOLDER_PATH}/dump.rdb` : '/dumps/dump.rdb';

            const formData = new FormData();
            const fileBuffer = await fs.promises.readFile(dumpPath);
            formData.append('file', fileBuffer, {
                filename: `${baseName}.rdb`,
                contentType: 'application/octet-stream'
            });

            const response = await fetch(backupUrl, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${process.env.DELEGATED_STORAGE_TOKEN}`
                },
                body: formData
            });

            if (response.ok) {
                results.push(`RDB backup: ${baseName}.rdb uploaded successfully`);
            } else {
                const errorText = await response.text();
                results.push(`RDB backup failed: ${response.statusText} - ${errorText}`);
            }
        } catch (err) {
            results.push(`RDB backup failed: ${(err as Error).message}`);
        }
    }

    if (fileFormat === 'json' || fileFormat === 'rdb' || fileFormat === 'both') {
        try {
            const catalog = await getCatalog();

            if (catalog.data && Array.isArray(catalog.data)) {
                const formData = new FormData();
                const catalogJson = JSON.stringify(catalog.data, null, 2);
                const catalogBuffer = Buffer.from(catalogJson, 'utf-8');
                formData.append('file', catalogBuffer, {
                    filename: `${baseName}.json`,
                    contentType: 'application/json'
                });

                const postBackupFileJson = await fetch(backupUrl, {
                    method: 'POST',
                    headers: {
                        ...(process.env.DELEGATED_STORAGE_TOKEN && {
                            Authorization: `Bearer ${process.env.DELEGATED_STORAGE_TOKEN}`
                        })
                    },
                    body: formData
                });

                if (postBackupFileJson.status === 200) {
                    results.push(`JSON backup: ${baseName}.json uploaded successfully`);
                } else {
                    const errorText = await postBackupFileJson.text();
                    results.push(`JSON backup failed: ${errorText}`);
                }
            } else {
                results.push('JSON backup skipped: No catalog data available');
            }
        } catch (err) {
            results.push(`JSON backup failed: ${(err as Error).message}`);
        }
    }

    const hasErrors = results.some((r) => r.includes('failed'));
    return {
        status: hasErrors ? 207 : 200,
        data: [`Dual backup completed: ${results.join(', ')}`],
        errors: hasErrors ? ['Some backups failed'] : []
    };
};

export const restoreDump = async (filename = null, format = 'rdb') => {
    try {
        let jsonRestoreSuccess = false;

        try {
            let jsonFilename = filename;
            if (filename && !filename.endsWith('.json') && !filename.endsWith('.rdb')) {
                jsonFilename = filename + '.json';
            }
            const jsonDumpResult = await getDump(jsonFilename, 'json');

            if (jsonDumpResult.status === 200) {
                const catalogData = JSON.parse(jsonDumpResult.data[0]);

                if (Array.isArray(catalogData)) {
                    const clearResult = await redisHandler.flushAllKeys();
                    if (!clearResult.success) {
                        throw new Error(`Failed to clear Redis keys: ${clearResult.error}`);
                    }

                    if (catalogData.length > 0) {
                        await addCatalogItems(catalogData);
                    }

                    await initializeCache();

                    return {
                        status: 200,
                        data: [`Successfully restored ${catalogData.length} items from JSON backup without container restart`],
                        errors: []
                    };
                }
            }
        } catch (jsonError) {
            logger.info(`JSON restore failed, will try RDB: ${jsonError.message}`);
        }

        if (!jsonRestoreSuccess) {
            let rdbFilename = filename;
            if (filename && !filename.endsWith('.json') && !filename.endsWith('.rdb')) {
                rdbFilename = filename + '.rdb';
            }
            const rdbDumpResult = await getDump(rdbFilename, 'rdb');

            if (rdbDumpResult.status !== 200) {
                return {
                    status: 404,
                    data: [],
                    errors: [`Neither JSON nor RDB backup found for: ${filename || 'latest'}`]
                };
            }

            const dumpData = Buffer.from(rdbDumpResult.data[0], 'base64');
            const fs = await import('fs').then((m) => m.promises);
            const dumpPath = process.env.DUMP_FOLDER_PATH ? `${process.env.DUMP_FOLDER_PATH}/dump.rdb` : '/dumps/dump.rdb';

            await redisHandler.flushAllKeys();
            await fs.writeFile(dumpPath, dumpData);

            return {
                status: 200,
                data: [`RDB backup restored to ${dumpPath}. Data will be available after Redis restart.`],
                errors: ['Note: JSON backup not available, using RDB. Consider restarting Redis service for immediate effect.']
            };
        }
    } catch (error) {
        return {
            status: 500,
            data: [],
            errors: [`Error restoring dump: ${error.message}`]
        };
    }
};

export const getFile = async ({ filepath, version, mimetype }: FileProps): Promise<BackupProps> => {
    try {
        const backupGet: ResponseBackup = await fetch(`${generateUrl()}?filepath=${filepath}&version=${version}&mimetype=${mimetype}`, generateOptions('GET', 'application/json'));

        if (backupGet.status === 200) {
            const stream = filepath.includes('.json') ? await backupGet.json() : backupGet.body;
            return { status: 200, stream };
        }
        return { status: backupGet.status, stream: null };
    } catch (errorMessage: any) {
        logger.error(`ERROR: ${errorMessage}`);
    }
    return null;
};

export const upload = async (stream, file, datum): Promise<BackupProps> => {
    try {
        const form = generateFormDataWithFile(stream, file, datum);
        const backupUpload: ResponseBackup = await fetch(generateUrl(), generateOptions('POST', '', form));

        if (backupUpload.status === 401) {
            return { status: 401, error: 'Authentication failed' };
        }
        const backupUploadResponse = await backupUpload.json();
        if (backupUploadResponse.version) {
            await updateCatalogItem(datum.uuid, { version: backupUploadResponse.version });
        }
        if (backupUpload.status === 201 || backupUpload.status === 200) {
            return { status: 200, stream: backupUpload.body };
        }
        return { status: backupUpload.status, stream: null };
    } catch (errorMessage: any) {
        logger.error(`ERROR: ${errorMessage}`);
        logger.error('Upload error details:', errorMessage);
    }
    return null;
};

export const update = async (file, stream, info): Promise<BackupProps> => {
    try {
        const form = stream && generateFormDataWithFile(stream, file, info);
        const backupUpload: ResponseBackup = await fetch(
            generateUrl(),
            stream
                ? generateOptions('PATCH', '', form)
                : generateOptions(
                      'PATCH',
                      'application/json',
                      JSON.stringify({
                          unique_name: file.unique_name,
                          version: file.version,
                          ...info
                      })
                  )
        );

        if (backupUpload.status === 401) {
            logger.error('Authentication failed. Token:', process.env.DELEGATED_STORAGE_TOKEN);
            return { status: 401, error: 'Authentication failed' };
        }

        if (backupUpload.status === 201 || backupUpload.status === 200) {
            return { status: 200, stream: backupUpload.body };
        }
        return { status: backupUpload.status, stream: null };
    } catch (errorMessage: any) {
        logger.error(`ERROR: ${errorMessage}`);
        logger.error('Upload error details:', errorMessage);
    }
    return null;
};

export const deleteFile = async (itemToUpdate): Promise<BackupProps> => {
    try {
        const backupUpload: ResponseBackup = await fetch(generateUrl(), generateOptions('DELETE', 'application/json', JSON.stringify({ ...itemToUpdate })));

        if (backupUpload.status === 401) {
            logger.error('Authentication failed. Token:', process.env.DELEGATED_STORAGE_TOKEN);
            return { status: 401, error: 'Authentication failed' };
        }

        if (backupUpload.status === 201 || backupUpload.status === 200) {
            return { status: 200 };
        }
        return { status: backupUpload.status };
    } catch (errorMessage: any) {
        logger.error(`ERROR: ${errorMessage}`);
        logger.error('Delete error details:', errorMessage);
    }
    return null;
};
