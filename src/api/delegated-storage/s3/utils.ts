import { minioClient } from './connection';
import { FileProps } from '../types';
import { promisify } from 'node:util';
import { getLastVersion } from '../../catalog/redis/operations';
import app from '../../app';
import { addCatalogItems } from '../../catalog';
import { PassThrough } from 'stream';
import { createReadStream } from 'fs';
import { FilesProps } from '../index';

export const getLastDump = async () => {
    const getObjectAsync = promisify(minioClient.getObject.bind(minioClient));
    const listObjects = new Promise<any[]>((resolve, reject) => {
        const objectsList: any[] = [];
        const stream = minioClient.listObjectsV2('media', `${ app.locals.PREFIXED_CATALOG }/`, true);
        stream.on('data', (obj) => objectsList.push(obj.name));
        stream.on('end', () => resolve(objectsList));
        stream.on('error', (err) => reject(err));
    });

    const objectsList = await listObjects;
    if (!Array.isArray(objectsList) || objectsList.length === 0) {
        return { data: null, errors: 'No dump found' };
    }

    const lastObject = getLastVersion(objectsList);
    const dataStream = await getObjectAsync('media', lastObject);

    const lastDump = await new Promise<string>((resolve, reject) => {
        let data = '';
        dataStream.on('data', (chunk: Buffer) => {
            data += chunk.toString('utf-8');
        });
        dataStream.on('end', () => {
            resolve(data);
        });
        dataStream.on('error', (err: Error) => {
            reject(err);
        });
    });
    const files = JSON.parse(lastDump);

    if (files.length) {
        await addCatalogItems(files);
    }
    return { data: 'OK', errors: null };
};

export const createDump = async () => {
    const getObjectAsync = promisify(minioClient.getObject.bind(minioClient));
    const listObjects = new Promise<any[]>((resolve, reject) => {
        const objectsList: any[] = [];
        const stream = minioClient.listObjectsV2('media', `${ app.locals.PREFIXED_CATALOG }/`, true);
        stream.on('data', (obj) => objectsList.push(obj.name));
        stream.on('end', () => resolve(objectsList));
        stream.on('error', (err) => reject(err));
    });

    const objectsList = await listObjects;
    if (!Array.isArray(objectsList) || objectsList.length === 0) {
        return { data: null, errors: 'No dump found' };
    }

    const lastObject = getLastVersion(objectsList);
    const dataStream = await getObjectAsync('media', lastObject);

    const lastDump = await new Promise<string>((resolve, reject) => {
        let data = '';
        dataStream.on('data', (chunk: Buffer) => {
            data += chunk.toString('utf-8');
        });
        dataStream.on('end', () => {
            resolve(data);
        });
        dataStream.on('error', (err: Error) => {
            reject(err);
        });
    });
    const files = JSON.parse(lastDump);

    if (files.length) {
        await addCatalogItems(files);
    }
    return { data: 'OK', errors: null };
};


export const getFile = async ({ filename }: any) => {
    try {
        const dataStream = await minioClient.getObject(process.env.S3_BUCKET_NAME, filename);
        return {
            status: 200,
            message: `Get image ${ filename } from S3 bucket`,
            stream: dataStream
        };
    } catch ( error ) {
        if (error.code === 'NoSuchKey') {
            return {
                status: 404,
                message: `File ${ filename } not found in S3 bucket`
            };
        } else {
            return {
                status: 500,
                message: `An error occurred while retrieving file ${ filename }: ${ error.message }`
            };
        }
    }
};

export const upload = async (stream, file, datum) => {
    const { etag } = await minioClient.putObject(process.env.S3_BUCKET_NAME, datum.unique_name, file);
    return {
        status: 200,
        message: `Successfully uploaded file ${ datum.unique_name } to S3 bucket with etag ${ etag }!`
    };
};

export const uploads = async ({ filespath, files }: FilesProps) => {
    try {
        const results = [];

        for ( let i = 0; i < filespath.length; i++ ) {
            const filename = filespath[i];
            const file = files[i];

            const { etag } = await minioClient.putObject(process.env.S3_BUCKET_NAME, filename, file);

            results.push({
                filename,
                status: 200,
                message: `Successfully uploaded file ${ filename } to S3 bucket with etag ${ etag }!`
            });
        }

        return {
            status: 200,
            results
        };
    } catch ( error ) {
        return {
            status: 500,
            message: `An error occurred while uploading files: ${ error.message }`
        };
    }
};


export const update = async (file, info) => {
    const filename = info.unique_name;
    try {

        await minioClient.putObject(process.env.S3_BUCKET_NAME, filename, file);
        const dataStream = await minioClient.getObject(process.env.S3_BUCKET_NAME, filename);
        return {
            status: 200,
            message: `Update image ${ filename } from S3 bucket`,
            stream: dataStream
        };
    } catch ( error ) {
        if (error.code === 'NoSuchKey') {
            return {
                status: 404,
                message: `File ${ filename } not found in S3 bucket`
            };
        } else {
            return {
                status: 500,
                message: `An error occurred while retrieving file ${ filename }: ${ error.message }`
            };
        }
    }
};

export const updates = async ({ filespath, files }: FilesProps) => {
    try {
        const results = [];

        for ( let i = 0; i < filespath.length; i++ ) {
            const filename = filespath[i];
            const file = files[i];

            await minioClient.putObject(process.env.S3_BUCKET_NAME, filename, file);
            const dataStream = await minioClient.getObject(process.env.S3_BUCKET_NAME, filename);

            results.push({
                filename,
                status: 200,
                message: `Update image ${ filename } from S3 bucket`,
                stream: dataStream
            });
        }

        return {
            status: 200,
            message: `${ results }`
        };
    } catch ( error ) {
        if (error.code === 'NoSuchKey') {
            return {
                status: 404,
                message: `One or more files not found in S3 bucket`
            };
        } else {
            return {
                status: 500,
                message: `An error occurred while processing files: ${ error.message }`
            };
        }
    }
};

export const deleteFile = async ({ filename }: any) => {
    try {
        await minioClient.removeObject(process.env.S3_BUCKET_NAME, filename);
        return {
            status: 200,
            message: `Delete image ${filename} from S3 bucket`
        };
    } catch ( error ) {
        if (error.code === 'NoSuchKey') {
            return {
                status: 404,
                message: `File ${ filename } not found in S3 bucket`
            };
        } else {
            return {
                status: 500,
                message: `An error occurred while retrieving file ${ filename }: ${ error.message }`
            };
        }
    }
};

export const deleteFiles = async ({ filespath }: any) => {
    try {
        for ( const filename of filespath ) {
            await minioClient.removeObject(process.env.S3_BUCKET_NAME, filename);
        }
        return {
            status: 200,
            message: `Delete images ${filespath} from S3 bucket`
        };
    } catch ( error ) {
        if (error.code === 'NoSuchKey') {
            return {
                status: 404,
                message: `File ${ filespath } not found in S3 bucket`
            };
        } else {
            return {
                status: 500,
                message: `An error occurred while retrieving file ${ filespath }: ${ error.message }`
            };
        }
    }
};