import { minioClient } from './connection';
import { getCatalogRedis } from '../../catalog/redis/operations';
import { redisHandler } from '../../catalog/redis/connection';
import { getCurrentDateVersion } from '../../utils/catalog';
import { logger } from '../../utils/logs/winston';

export const createDump = async (filename = null, format = 'rdb') => {
    try {
        const timestamp = getCurrentDateVersion();

        const bucketName = process.env.S3_BUCKET_NAME || 'media';
        const results = [];

        if (format === 'rdb' || format === 'both') {
            try {
                await redisHandler.generateDump();

                const fs = await import('fs').then((m) => m.promises);
                const dumpPath = process.env.DUMP_FOLDER_PATH ? `${process.env.DUMP_FOLDER_PATH}/dump.rdb` : '/dumps/dump.rdb';
                const rdbContent = await fs.readFile(dumpPath);
                const rdbObjectName = filename ? `dumps/${filename}.rdb` : `dumps/dump_${timestamp}.rdb`;

                await minioClient.putObject(bucketName, rdbObjectName, rdbContent);
                results.push(`RDB dump: ${rdbObjectName}`);
            } catch (rdbError) {
                results.push(`RDB dump failed: ${rdbError.message}`);
            }
        }

        if (format === 'json' || format === 'rdb' || format === 'both') {
            try {
                const { data: catalog } = await getCatalogRedis();

                if (catalog && Array.isArray(catalog)) {
                    const catalogJson = JSON.stringify(catalog, null, 2);
                    const jsonContent = Buffer.from(catalogJson, 'utf-8');
                    const jsonObjectName = filename ? `dumps/${filename}.json` : `dumps/dump_${timestamp}.json`;

                    await minioClient.putObject(bucketName, jsonObjectName, jsonContent);
                    results.push(`JSON dump: ${jsonObjectName}`);
                } else {
                    results.push('JSON dump skipped: No catalog data available');
                }
            } catch (jsonError) {
                results.push(`JSON dump failed: ${jsonError.message}`);
            }
        }

        return {
            status: 200,
            data: [`Successfully created dual backups: ${results.join(', ')}`],
            errors: []
        };
    } catch (error) {
        return {
            status: 500,
            data: [],
            errors: [`Error creating dump: ${error.message}`]
        };
    }
};
export const restoreDump = async (filename = null) => {
    try {
        let jsonRestoreSuccess = false;

        try {
            const jsonFilename = filename ? filename.replace(/\.(rdb|json)$/, '') + '.json' : null;
            const jsonDumpResult = await getDump(jsonFilename, 'json');

            if (jsonDumpResult.status === 200) {
                const catalogData = JSON.parse(jsonDumpResult.data[0]);

                if (Array.isArray(catalogData)) {
                    const clearResult = await redisHandler.flushAllKeys();
                    if (!clearResult.success) {
                        throw new Error(`Failed to clear Redis keys: ${clearResult.error}`);
                    }

                    if (catalogData.length > 0) {
                        const { addCatalogItems } = await import('../../catalog');
                        await addCatalogItems(catalogData);
                    }

                    const { initializeCache } = await import('../../catalog/redis/connection');
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
            const rdbFilename = filename ? filename.replace(/\.(rdb|json)$/, '') + '.rdb' : null;
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

export const getDump = async (filename = null, format = 'rdb') => {
    try {
        const bucketName = process.env.S3_BUCKET_NAME || 'media';
        let objectName = filename;

        if (!objectName) {
            const listObjects = new Promise<any[]>((resolve, reject) => {
                const objectsList: any[] = [];
                const prefix = 'dumps/';
                const stream = minioClient.listObjectsV2(bucketName, prefix, true);
                stream.on('data', (obj) => {
                    if (format === 'rdb' && obj.name.endsWith('.rdb')) {
                        objectsList.push(obj);
                    } else if (format === 'json' && obj.name.endsWith('.json')) {
                        objectsList.push(obj);
                    }
                });
                stream.on('end', () => resolve(objectsList));
                stream.on('error', (err) => reject(err));
            });

            const objects = await listObjects;
            if (!objects.length) {
                return {
                    status: 404,
                    data: [],
                    errors: [`No ${format} dumps found in S3`]
                };
            }

            const sortedObjects = objects.sort((a, b) => b.name.localeCompare(a.name));
            objectName = sortedObjects[0].name;
        }

        const dataStream = await minioClient.getObject(bucketName, objectName);

        if (format === 'rdb') {
            const chunks: Buffer[] = [];
            const dumpBuffer = await new Promise<Buffer>((resolve, reject) => {
                dataStream.on('data', (chunk: Buffer) => {
                    chunks.push(chunk);
                });
                dataStream.on('end', () => {
                    resolve(Buffer.concat(chunks));
                });
                dataStream.on('error', (err: Error) => reject(err));
            });

            return {
                status: 200,
                data: [dumpBuffer.toString('base64')],
                errors: []
            } as any;
        } else {
            const dumpData = await new Promise<string>((resolve, reject) => {
                let data = '';
                dataStream.on('data', (chunk: Buffer) => {
                    data += chunk.toString('utf-8');
                });
                dataStream.on('end', () => resolve(data));
                dataStream.on('error', (err: Error) => reject(err));
            });

            return {
                status: 200,
                data: [dumpData],
                errors: []
            } as any;
        }
    } catch (error) {
        if (error.code === 'NoSuchKey') {
            return {
                status: 404,
                data: [],
                errors: [`Dump file not found: ${filename}`]
            };
        }

        return {
            status: 500,
            data: [],
            errors: [`Error getting dump from S3: ${error.message}`]
        };
    }
};

export const getFile = async ({ filename }: any) => {
    try {
        const dataStream = await minioClient.getObject(process.env.S3_BUCKET_NAME, filename);
        return {
            status: 200,
            message: `Get image ${filename} from S3 bucket`,
            stream: dataStream
        };
    } catch (error) {
        if (error.code === 'NoSuchKey') {
            return {
                status: 404,
                message: `File ${filename} not found in S3 bucket`
            };
        } else {
            return {
                status: 500,
                message: `An error occurred while retrieving file ${filename}: ${error.message}`
            };
        }
    }
};

// SINGLE UPLOAD / UPDATE / DELETE
export const upload = async (backupObject) => {
    const { stream, catalogItem: datum, original } = backupObject;
    const { etag } = await minioClient.putObject(process.env.S3_BUCKET_NAME, original ? datum.unique_name.replace(datum.filename, datum.original_filename) : datum.unique_name, stream);
    return {
        status: 200,
        message: `Successfully uploaded file ${datum.unique_name} to S3 bucket with etag ${etag}!`
    };
};

export const update = async (backupObject) => {
    const { stream, file, catalogItem: info } = backupObject;
    const filename = info.unique_name;
    try {
        await minioClient.putObject(process.env.S3_BUCKET_NAME, filename, stream);
        const dataStream = await minioClient.getObject(process.env.S3_BUCKET_NAME, filename);
        return {
            status: 200,
            message: `Update image ${filename} from S3 bucket`,
            stream: dataStream
        };
    } catch (error) {
        if (error.code === 'NoSuchKey') {
            return {
                status: 404,
                message: `File ${filename} not found in S3 bucket`
            };
        } else {
            return {
                status: 500,
                message: `An error occurred while retrieving file ${filename}: ${error.message}`
            };
        }
    }
};

export const deleteFile = async (catalogItem: any) => {
    try {
        const filename = catalogItem.unique_name || catalogItem.filename || catalogItem;
        await minioClient.removeObject(process.env.S3_BUCKET_NAME, filename);
        return {
            status: 200,
            message: `Delete
            image ${filename}from S3 bucket`
        };
    } catch (error) {
        const filename = catalogItem.unique_name || catalogItem.filename || catalogItem;
        if (error.code === 'NoSuchKey') {
            return {
                status: 404,
                message: `File ${filename} not found in S3 bucket`
            };
        } else {
            return {
                status: 500,
                message: `An error occurred while deleting file ${filename}: ${error.message}`
            };
        }
    }
};

//MULTI UPLOADS / UPDATES / DELETE
export const uploads = async (files) => {
    const data = [];
    const errors = [];
    for (const file of files) {
        const { etag } = await minioClient.putObject(process.env.S3_BUCKET_NAME, file.catalogItem.unique_name, file.stream);
        if (etag) {
            data.push(`Successfully uploaded file ${file.catalogItem.unique_name} to S3 bucket with etag ${etag}!`);
        } else {
            errors.push(`Adding failed for ${file.catalogItem.unique_name} to S3 bucket`);
        }
    }
    return {
        status: 200,
        data,
        errors
    };
};

export const updates = async (files) => {
    const data = [];
    const errors = [];
    for (const file of files) {
        try {
            await minioClient.putObject(process.env.S3_BUCKET_NAME, file.catalogItem.unique_name, file.stream);
            const dataStream = await minioClient.getObject(process.env.S3_BUCKET_NAME, file.catalogItem.unique_name);
            if (dataStream) {
                data.push(`File ${file.catalogItem.unique_name} patched successfully `);
            }
        } catch (error) {
            if (error.code === 'NoSuchKey') {
                errors.push(`File ${file.catalogItem.unique_name} not found in S3 bucket`);
            } else {
                errors.push(`An error occurred while retrieving file ${file.catalogItem.unique_name}: ${error.message}`);
            }
        }
    }
    return {
        status: 200,
        data,
        errors
    };
};

export const deletes = async (files) => {
    const data = [];
    const errors = [];
    for (const file of files) {
        try {
            await minioClient.removeObject(process.env.S3_BUCKET_NAME, file.catalogItem.unique_name);
            data.push(`File ${file.catalogItem.unique_name} deleted successfully `);
        } catch (error) {
            if (error.code === 'NoSuchKey') {
                errors.push(`File ${file.catalogItem.unique_name} not found in S3 bucket`);
            } else {
                errors.push(`An error occurred while retrieving file ${file.catalogItem.unique_name}: ${error.message}`);
            }
        }
    }
    return {
        status: 200,
        data,
        errors
    };
};
