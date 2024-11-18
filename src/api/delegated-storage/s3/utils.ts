import { minioClient } from './connection';
import { FileProps } from '../types';
import { promisify } from 'node:util';
import { addMultipleFiles, getLastVersion } from '../../utils/redis/operations';
import { connectClient, disconnectClient } from '../../utils/redis/connection';
import app from '../../app';

export const getLastDump = async () => {
    const getObjectAsync = promisify(minioClient.getObject.bind(minioClient));
    const listObjects = new Promise<any[]>((resolve, reject) => {
        const objectsList: any[] = [];
        const stream = minioClient.listObjectsV2('media', `${app.locals.PREFIXED_CATALOG}/`, true);
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
        await connectClient();
        await addMultipleFiles(files);
        await disconnectClient();
    }
    return { data: 'OK', errors: null };
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

export const uploads = async ({ filename, file }: FileProps) => {
    const { etag } = await minioClient.putObject(process.env.S3_BUCKET_NAME, filename, file);
    return {
        status: 200,
        message: `Successfully uploaded file ${filename} to S3 bucket with etag ${etag}!`
    };
};

export const updateFile = async ({ filename, file }: FileProps) => {
    try {
        const dataStream = await minioClient.putObject(process.env.S3_BUCKET_NAME, filename, file);
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

export const deleteFile = async ({ filename }: any) => {
    try {
        const dataStream = await minioClient.removeObject(process.env.S3_BUCKET_NAME, filename);
        return {
            status: 200,
            message: `Delete image ${filename} from S3 bucket`,
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
