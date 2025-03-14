import { BaseStorage, StorageResponse, StorageFileProps, StorageFilesProps } from '../baseStorage';
import { logger } from '../../../utils/logs/winston';
import { s3Connection } from './connection';
import { getCurrentDateVersion } from '../../../utils/date';
import { CatalogService } from '../../../core/services/catalog.service';
import { Readable } from 'stream';

export class S3Storage extends BaseStorage {
    private bucketName: string;
    private catalogService: CatalogService;

    constructor() {
        super('S3');
        this.bucketName = process.env.S3_BUCKET_NAME || 'media';
        this.catalogService = new CatalogService();
        this.initBucket();
    }

    private async initBucket(): Promise<void> {
        try {
            // Ensure bucket exists
            await s3Connection.createBucket(this.bucketName);
            logger.info(`S3Storage initialized with bucket: ${this.bucketName}`);
        } catch (error) {
            logger.error(`Failed to initialize S3 bucket: ${error}`);
            throw new Error(`Failed to initialize S3 storage: ${error}`);
        }
    }

    private async streamToString(stream: NodeJS.ReadableStream): Promise<string> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];

            stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
            stream.on('error', (err) => reject(err));
            stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        });
    }

    async getFile(props: StorageFileProps): Promise<StorageResponse> {
        const { filepath } = props;
        try {
            const stream = await s3Connection.getObject(this.bucketName, filepath);
            return this.createSuccessResponse(stream, `Get file ${filepath} from S3 bucket`);
        } catch (error: any) {
            if (error.code === 'NoSuchKey') {
                return this.createNotFoundResponse(filepath);
            }
            logger.error(`Error getting file from S3: ${error}`);
            return this.createErrorResponse(500, `Failed to get file ${filepath}: ${error}`);
        }
    }

    async upload(props: StorageFileProps): Promise<StorageResponse> {
        const { filepath, file } = props;
        try {
            if (!file) {
                return this.createErrorResponse(400, 'No file content provided');
            }

            const { etag } = await s3Connection.putObject(this.bucketName, filepath, file);
            return this.createSuccessResponse(null, `File ${filepath} uploaded successfully to S3 with etag ${etag}`);
        } catch (error) {
            logger.error(`Error uploading file to S3: ${error}`);
            return this.createErrorResponse(500, `Upload failed: ${error}`);
        }
    }

    async uploads(props: StorageFilesProps): Promise<StorageResponse> {
        const { filespath, files } = props;

        try {
            if (!Array.isArray(filespath) || !Array.isArray(files) || filespath.length !== files.length) {
                return this.createErrorResponse(400, 'Invalid files or paths provided');
            }

            const results: string[] = [];
            const errors: string[] = [];

            for (let i = 0; i < filespath.length; i++) {
                const filepath = filespath[i];
                const file = files[i];

                try {
                    await s3Connection.putObject(this.bucketName, filepath, file);
                    results.push(filepath);
                } catch (error) {
                    errors.push(filepath);
                    logger.error(`Failed to upload ${filepath}: ${error}`);
                }
            }

            return {
                status: 200,
                message: `Uploaded ${results.length} files, failed ${errors.length} files`,
                results: { success: results, errors }
            };
        } catch (error) {
            logger.error(`Error during bulk upload to S3: ${error}`);
            return this.createErrorResponse(500, `Upload failed: ${error}`);
        }
    }

    async update(props: StorageFileProps): Promise<StorageResponse> {
        return this.upload(props);
    }

    async updates(props: StorageFilesProps): Promise<StorageResponse> {
        return this.uploads(props);
    }

    async delete(props: StorageFileProps): Promise<StorageResponse> {
        const { filepath } = props;
        try {
            await s3Connection.removeObject(this.bucketName, filepath);
            return this.createSuccessResponse(null, `File ${filepath} deleted successfully from S3`);
        } catch (error: any) {
            if (error.code === 'NoSuchKey') {
                return this.createNotFoundResponse(filepath);
            }
            logger.error(`Error deleting file from S3: ${error}`);
            return this.createErrorResponse(500, `Failed to delete file ${filepath}: ${error}`);
        }
    }

    async deleteFiles(props: StorageFilesProps): Promise<StorageResponse> {
        const { filespath } = props;

        try {
            if (!Array.isArray(filespath)) {
                return this.createErrorResponse(400, 'No file paths provided or invalid format');
            }

            const results: string[] = [];
            const errors: string[] = [];

            for (const filepath of filespath) {
                try {
                    await s3Connection.removeObject(this.bucketName, filepath);
                    results.push(filepath);
                } catch (error: any) {
                    errors.push(filepath);
                    logger.error(`Failed to delete ${filepath}: ${error}`);
                }
            }

            return {
                status: 200,
                message: `Deleted ${results.length} files, failed ${errors.length} files`,
                results: { success: results, errors }
            };
        } catch (error) {
            logger.error(`Error during bulk delete from S3: ${error}`);
            return this.createErrorResponse(500, `Delete operation failed: ${error}`);
        }
    }

    async getLastDump(): Promise<StorageResponse> {
        try {
            const prefix = process.env.PREFIXED_CATALOG ? `${process.env.PREFIXED_CATALOG}/` : 'catalog/';
            const objectsList = await s3Connection.listObjects(this.bucketName, prefix);

            if (!objectsList || objectsList.length === 0) {
                return this.createErrorResponse(404, 'No dump files found');
            }

            const jsonFiles = objectsList
                .filter((name) => name.endsWith('.json'))
                .sort()
                .reverse();

            if (jsonFiles.length === 0) {
                return this.createErrorResponse(404, 'No JSON dump files found');
            }

            const latestDump = jsonFiles[0];

            const stream = await s3Connection.getObject(this.bucketName, latestDump);
            const data = await this.streamToString(stream);

            const parsedData = JSON.parse(data);

            if (Array.isArray(parsedData) && parsedData.length > 0) {
                await this.catalogService.addFiles(parsedData);
            }

            return this.createSuccessResponse(parsedData, `Loaded dump from ${latestDump}`);
        } catch (error) {
            logger.error(`Error getting last dump from S3: ${error}`);
            return this.createErrorResponse(500, `Failed to get last dump: ${error}`);
        }
    }

    async createDump(data: any): Promise<StorageResponse> {
        try {
            const fileVersion = getCurrentDateVersion();
            const prefix = process.env.PREFIXED_CATALOG ? `${process.env.PREFIXED_CATALOG}/` : 'catalog/';
            const dumpPath = `${prefix}${fileVersion}.json`;

            await s3Connection.putObject(this.bucketName, dumpPath, JSON.stringify(data));

            return this.createSuccessResponse(null, `Dump created successfully at ${dumpPath}`);
        } catch (error) {
            logger.error(`Error creating dump in S3: ${error}`);
            return this.createErrorResponse(500, `Failed to create dump: ${error}`);
        }
    }
}
