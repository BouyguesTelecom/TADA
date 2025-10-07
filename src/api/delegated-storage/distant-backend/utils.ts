import FormData from 'form-data';
import fs from 'fs';
import fetch from 'node-fetch';
import { addCatalogItems, getCatalog, updateCatalogItem } from '../../catalog';
import { initializeCache, redisHandler } from '../../catalog/redis/connection';
import { BackupMultiProps, BackupProps } from '../../props/delegated-storage';
import { logger } from '../../utils/logs/winston';
import { FileProps, ResponseBackup } from '../types';
import { getCurrentDateVersion } from '../../utils/catalog';

export const headersUserAgentForBackup = (contentType: string | null = null) => {
    const baseHeaders: any = {
        ...(process.env.DELEGATED_STORAGE_TOKEN && {
            Authorization: `Bearer ${process.env.DELEGATED_STORAGE_TOKEN}`
        })
    };
    if (contentType && typeof contentType === 'object') {
        return new Headers({
            ...baseHeaders,
            ...(contentType as Record<string, string>)
        });
    }
    return new Headers({
        ...baseHeaders,
        ...(contentType && { 'Content-Type': contentType })
    });
};

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

export const getDump = async (filename = null, format = 'json') => {
    try {
        let dumpUrl: string;

        if (filename) {
            dumpUrl = `${process.env.DELEGATED_STORAGE_HOST}${process.env.URL_TO_GET_BACKUP}/${encodeURIComponent(filename)}`;
        } else {
            const formatQuery = `?format=${format}`;
            dumpUrl = `${process.env.DELEGATED_STORAGE_HOST}/get-dump/latest${formatQuery}`;
        }

        logger.info(`Fetching dump from: ${dumpUrl} (format: ${format})`);
        const contentTypeHeader = format === 'json' ? 'application/json' : null;
        const response = await fetch(dumpUrl, generateOptions('GET', contentTypeHeader));

        if (response.status === 404) {
            return { status: 404, data: [], errors: [`❌ Dump requested not found : ${filename}`] };
        }
        if (format === 'json') {
            const jsonData = await response.json();
            return {
                status: 200,
                data: jsonData,
                errors: []
            };
        } else {
            const buffer = await response.arrayBuffer();
            return {
                status: 200,
                data: buffer,
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
    const timestamp = getCurrentDateVersion();
    const baseName = filePath ? filePath.replace(/\.(rdb|json)$/, '') : `dump_${timestamp}`;
    const results = [];
    const backupUrl = `${process.env.DELEGATED_STORAGE_HOST}${process.env.URL_TO_POST_BACKUP}`;

    try {
        await redisHandler.generateDump();
        const dumpPath = process.env.DUMP_FOLDER_PATH ? `${process.env.DUMP_FOLDER_PATH}/dump.rdb` : '/dumps/dump.rdb';
        const catalog = await getCatalog();
        if (!catalog.data || !Array.isArray(catalog.data)) {
            throw new Error('No catalog data available');
        }
        const formData = new FormData();

        const fileBuffer = await fs.promises.readFile(dumpPath);
        formData.append('dump', fileBuffer, {
            filename: `${baseName}.rdb`,
            contentType: 'application/octet-stream'
        });

        const catalogJson = JSON.stringify(catalog.data);
        formData.append('catalog', catalogJson, {
            filename: `${baseName}.json`,
            contentType: 'application/json'
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
            results.push(`JSON backup: ${baseName}.json uploaded successfully`);
            logger.info(`Dual backup completed successfully for ${baseName}`);
        } else {
            const errorText = await response.text();
            const errorMessage = `Dual backup failed: ${response.statusText} - ${errorText}`;
            results.push(errorMessage);
            logger.error(errorMessage);
        }
    } catch (error) {
        const errorMessage = `Dual backup failed: ${(error as Error).message}`;
        results.push(errorMessage);
        logger.error(errorMessage, error);
    }

    const hasErrors = results.some((r) => r.includes('failed'));

    return {
        status: hasErrors ? 500 : 200,
        data: results,
        errors: hasErrors ? results.filter((r) => r.includes('failed')) : []
    };
};

export const restoreDump = async (filename = null, format = 'rdb') => {
    try {
        const { status, data, errors } = await getDump(filename, 'json');
        if (status === 200 && Array.isArray(data)) {
            await redisHandler.flushAllKeys();
            await addCatalogItems(data);

            await initializeCache();

            return {
                status: 200,
                data: [`Successfully restored ${data.length} items from JSON backup without container restart`],
                errors: []
            };
        }
        return {
            status: 404,
            data: null,
            errors
        };
    } catch (error) {
        return {
            status: 500,
            data: [],
            errors: [`Error restoring dump: ${error.message}`]
        };
    }
};

export const getFile = async ({ filepath, version, mimetype, original }: FileProps): Promise<BackupProps> => {
    try {
        const backupGet: ResponseBackup = await fetch(
            `${generateUrl()}?filepath=${filepath}&version=${version}&mimetype=${mimetype}${original ? '&original=true' : ''}`,
            generateOptions('GET', 'application/json')
        );

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
//SINGLE UPLOAD / PATCH / DELETE
export const upload = async (backupObject): Promise<BackupProps> => {
    const { stream, file, catalogItem: datum, original } = backupObject;
    try {
        const form = generateFormDataWithFile(stream, file, datum);

        const backupUpload: ResponseBackup = await fetch(original ? generateUrl() + '?original=true' : generateUrl(), generateOptions('POST', '', form));

        if (backupUpload.status === 401) {
            return { status: 401, error: 'Authentication failed' };
        }
        const backupUploadResponse = await backupUpload.json();
        if (backupUploadResponse.version) {
            await updateCatalogItem(datum.uuid, original ? { original_version: backupUploadResponse.version } : { version: backupUploadResponse.version });
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

export const update = async (backupObject): Promise<BackupProps> => {
    const { stream, file, catalogItem: datum } = backupObject;
    try {
        const form = stream && generateFormDataWithFile(stream, file, datum);
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
                          ...datum
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

// MULTI UPLOADS / PATCH / DELETE
export const uploads = async (files): Promise<any> => {
    try {
        const form = new FormData();

        for (const [index, file] of files.entries()) {
            form.append(
                `file_${index}`,
                JSON.stringify({
                    file: file.file,
                    catalogItem: file.catalogItem,
                    ...(file.original && { original: file.original.toString() })
                })
            );
        }

        for (const file of files) {
            form.append('files', file.stream, file.file);
        }
        const backupUpload: ResponseBackup = await fetch(generateUrl('MULTI'), generateOptions('POST', form.getHeaders(), form));

        const backupUploadResponse = await backupUpload.json();

        if (Array.isArray(backupUploadResponse)) {
            for (const [index, file] of backupUploadResponse.entries()) {
                if (file.version) {
                    await updateCatalogItem(files[index].catalogItem.uuid, { version: file.version });
                }
            }
        }
        if (backupUpload.status === 201 || backupUpload.status === 200) {
            return { status: 200 };
        }
        return { status: backupUpload.status };
    } catch (errorMessage: any) {
        logger.error(`ERROR: ${errorMessage}`);
        logger.error('Upload error details:', errorMessage);
    }
    return null;
};

export const updates = async (files): Promise<BackupProps> => {
    try {
        const form = new FormData();
        const fileInfo = files[0].fileInfo;
        form.append('unique_names', files.map((file) => file.catalogItem.unique_name).join(','));
        form.append('public_urls', files.map((file) => file.catalogItem.public_url).join(','));
        for (const key in fileInfo) {
            if (fileInfo.hasOwnProperty(key) && fileInfo[key]) {
                form.append(key, fileInfo[key]);
            }
        }
        for (const file of files) {
            form.append('files', file.stream, {
                filename: file.catalogItem.filename,
                contentType: 'application/octet-stream'
            });
        }
        const backupUpload: ResponseBackup = await fetch(generateUrl('MULTI'), generateOptions('PATCH', '', form));
        const backupUploadResponse = await backupUpload.json();
        if (backupUpload.status === 201 || backupUpload.status === 200) {
            return { status: backupUpload.status };
        }
        return { status: backupUpload.status };
    } catch (errorMessage: any) {
        logger.error(`ERROR: ${errorMessage}`);
        logger.error('Upload error details:', errorMessage);
    }
    return null;
};

export const deletes = async (files): Promise<BackupMultiProps> => {
    try {
        const backupUpload: ResponseBackup = await fetch(generateUrl('MULTI'), generateOptions('DELETE', 'application/json', JSON.stringify(files)));
        const { data, errors } = await backupUpload.json();
        if (backupUpload.status === 201 || backupUpload.status === 200) {
            return { status: backupUpload.status, data, errors };
        }
        return { status: backupUpload.status };
    } catch (errorMessage: any) {
        logger.error(`ERROR: ${errorMessage}`);
        logger.error('Delete error details:', errorMessage);
    }
    return null;
};
