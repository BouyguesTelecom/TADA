import { IFile } from '../../../core/interfaces/Ifile';
import { IStorageResponse } from '../../../core/interfaces/Istorage';
import { CatalogService } from '../../../core/services/catalog.service';
import { getCurrentDateVersion } from '../../../utils/date';
import { logger } from '../../../utils/logs/winston';
import { BaseStorage, StorageFileProps } from '../baseStorage';
import { s3Connection } from './connection';

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

    protected async getFileFromStorage(props: StorageFileProps): Promise<IStorageResponse> {
        const { filepath } = props;
        try {
            const stream = await s3Connection.getObject(this.bucketName, filepath);
            return this.createSuccessResponse(stream, `Get file ${filepath} from S3 bucket`);
        } catch (error: any) {
            if (error.code === 'NoSuchKey') {
                return this.createNotFoundResponse(filepath);
            }
            logger.error(`Error getting file from S3: ${error}`);
            return this.createErrorResponse(`Failed to get file ${filepath}: ${error}`);
        }
    }

    protected async upload(props: StorageFileProps): Promise<IStorageResponse> {
        const { filepath, file } = props;
        try {
            if (!file) {
                return this.createErrorResponse('No file content provided');
            }

            const { etag } = await s3Connection.putObject(this.bucketName, filepath, file);
            return this.createSuccessResponse(null, `File ${filepath} uploaded successfully to S3 with etag ${etag}`);
        } catch (error) {
            logger.error(`Error uploading file to S3: ${error}`);
            return this.createErrorResponse(`Upload failed: ${error}`);
        }
    }

    protected async deleteFromStorage(props: StorageFileProps): Promise<IStorageResponse> {
        const { filepath } = props;
        try {
            await s3Connection.removeObject(this.bucketName, filepath);
            return this.createSuccessResponse(null, `File ${filepath} deleted successfully from S3`);
        } catch (error: any) {
            if (error.code === 'NoSuchKey') {
                return this.createNotFoundResponse(filepath);
            }
            logger.error(`Error deleting file from S3: ${error}`);
            return this.createErrorResponse(`Failed to delete file ${filepath}: ${error}`);
        }
    }

    protected async getLastDumpFromStorage(): Promise<IStorageResponse> {
        try {
            const prefix = process.env.PREFIXED_CATALOG ? `${process.env.PREFIXED_CATALOG}/` : 'catalog/';
            const objectsList = await s3Connection.listObjects(this.bucketName, prefix);

            if (!objectsList || objectsList.length === 0) {
                return this.createErrorResponse('No dump files found');
            }

            const jsonFiles = objectsList
                .filter((name) => name.endsWith('.json'))
                .sort()
                .reverse();

            if (jsonFiles.length === 0) {
                return this.createErrorResponse('No JSON dump files found');
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
            return this.createErrorResponse(`Failed to get last dump: ${error}`);
        }
    }

    async uploads(files: Array<{ filepath: string; file?: Buffer; metadata?: Partial<IFile> }>): Promise<IStorageResponse> {
        try {
            if (!Array.isArray(files) || !files.length) {
                return this.createErrorResponse('Invalid files provided');
            }

            const results: string[] = [];
            const errors: string[] = [];

            for (const file of files) {
                if (!file.file) {
                    errors.push(file.filepath);
                    continue;
                }

                try {
                    await s3Connection.putObject(this.bucketName, file.filepath, file.file);
                    results.push(file.filepath);
                } catch (error) {
                    errors.push(file.filepath);
                    logger.error(`Failed to upload ${file.filepath}: ${error}`);
                }
            }

            return this.createSuccessResponse({ success: results, errors }, `Uploaded ${results.length} files, failed ${errors.length} files`);
        } catch (error) {
            logger.error(`Error during bulk upload to S3: ${error}`);
            return this.createErrorResponse(`Upload failed: ${error}`);
        }
    }

    async deleteFiles(files: Array<{ filepath: string }>): Promise<IStorageResponse> {
        try {
            if (!Array.isArray(files) || !files.length) {
                return this.createErrorResponse('Invalid files provided');
            }

            const results: string[] = [];
            const errors: string[] = [];

            for (const file of files) {
                try {
                    await s3Connection.removeObject(this.bucketName, file.filepath);
                    results.push(file.filepath);
                } catch (error: any) {
                    errors.push(file.filepath);
                    logger.error(`Failed to delete ${file.filepath}: ${error}`);
                }
            }

            return this.createSuccessResponse({ success: results, errors }, `Deleted ${results.length} files, failed ${errors.length} files`);
        } catch (error) {
            logger.error(`Error during bulk delete from S3: ${error}`);
            return this.createErrorResponse(`Delete operation failed: ${error}`);
        }
    }

    async createDump(data: any): Promise<IStorageResponse> {
        try {
            const fileVersion = getCurrentDateVersion();
            const prefix = process.env.PREFIXED_CATALOG ? `${process.env.PREFIXED_CATALOG}/` : 'catalog/';
            const dumpPath = `${prefix}${fileVersion}.json`;

            await s3Connection.putObject(this.bucketName, dumpPath, JSON.stringify(data));

            return this.createSuccessResponse(null, `Dump created successfully at ${dumpPath}`);
        } catch (error) {
            logger.error(`Error creating dump in S3: ${error}`);
            return this.createErrorResponse(`Failed to create dump: ${error}`);
        }
    }
}
