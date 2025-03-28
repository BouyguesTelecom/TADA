import FormData from 'form-data';
import fetch from 'node-fetch';
import { IFile } from '../../../core/interfaces/Ifile';
import { IStorageResponse } from '../../../core/interfaces/Istorage';
import { CatalogService } from '../../../core/services/catalog.service';
import { logger } from '../../../utils/logs/winston';
import { BaseStorage, StorageFileProps } from '../baseStorage';

export class DistantBackendStorage extends BaseStorage {
    private token: string;
    private host: string;
    private catalogService: CatalogService;

    constructor() {
        super('DISTANT_BACKEND');
        this.token = process.env.DELEGATED_STORAGE_TOKEN || '';
        this.host = process.env.DELEGATED_STORAGE_HOST || '';
        this.catalogService = new CatalogService();
        logger.info('Using DISTANT_BACKEND storage');
    }

    protected async getFileFromStorage(props: StorageFileProps): Promise<IStorageResponse> {
        try {
            const { filepath } = props;
            logger.info(`Getting file from distant backend: ${filepath}`);
            const apiUrl = `${this.host}/file?filepath=${encodeURIComponent(filepath)}`;

            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${this.token}`
                }
            });

            if (response.status !== 200) {
                return this.createErrorResponse(`Failed to get file from distant backend. Status: ${response.status}`);
            }

            const buffer = Buffer.from(await response.arrayBuffer());
            return this.createSuccessResponse(buffer, 'File retrieved successfully');
        } catch (error) {
            logger.error(`Error getting file from distant backend: ${error}`);
            return this.createErrorResponse(`Failed to get file: ${error}`);
        }
    }

    protected async upload(props: StorageFileProps): Promise<IStorageResponse> {
        try {
            const { filepath, file, metadata } = props;
            if (!file) {
                return this.createErrorResponse('No file provided');
            }

            logger.info(`Uploading file to distant backend: ${filepath}`);

            const formData = new FormData();

            const baseUrl = process.env.NGINX_INGRESS || 'http://localhost:8080';

            const fileMetadata = {
                unique_name: filepath,
                base_url: baseUrl,
                destination: metadata?.destination || '',
                filename: filepath.split('/').pop() || 'file',
                mimetype: metadata?.mimetype || 'application/octet-stream',
                size: metadata?.size || file.length,
                namespace: metadata?.namespace || 'default',
                version: metadata?.version || 1
            };

            formData.append('metadata', JSON.stringify([fileMetadata]));
            formData.append('file', file, {
                filename: filepath.split('/').pop() || 'file',
                contentType: metadata?.mimetype
            });

            logger.info(`Sending file to distant backend. Metadata: ${JSON.stringify(fileMetadata)}`);

            const apiUrl = `${this.host}/file?filepath=${encodeURIComponent(filepath)}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.token}`
                },
                body: formData
            });

            if (response.status !== 200) {
                let errorDetails = 'Failed to upload in backup /file';
                try {
                    const errorResponse = await response.json();
                    errorDetails = errorResponse.error || errorResponse.details || errorDetails;
                } catch (parseError) {
                    logger.error(`Error parsing error response: ${parseError}`);
                }

                logger.error(`Upload failed: ${errorDetails}`);
                return this.createErrorResponse(`Upload failed: ${errorDetails}`);
            }

            return this.createSuccessResponse(null, 'File uploaded successfully to distant backend');
        } catch (error) {
            logger.error(`Error uploading file to distant backend: ${error}`);
            return this.createErrorResponse(`Upload failed: ${error}`);
        }
    }

    protected async deleteFromStorage(props: StorageFileProps): Promise<IStorageResponse> {
        try {
            const { filepath } = props;
            logger.info(`Deleting file from distant backend: ${filepath}`);
            const apiUrl = `${this.host}/file?filepath=${encodeURIComponent(filepath)}`;

            const response = await fetch(apiUrl, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${this.token}`
                }
            });

            if (response.status !== 200) {
                return this.createErrorResponse(`Failed to delete file from distant backend. Status: ${response.status}`);
            }

            return this.createSuccessResponse(null, 'File deleted successfully from distant backend');
        } catch (error) {
            logger.error(`Error deleting file from distant backend: ${error}`);
            return this.createErrorResponse(`Failed to delete file: ${error}`);
        }
    }

    protected async getLastDumpFromStorage(): Promise<IStorageResponse> {
        try {
            const apiUrl = `${this.host}/catalog`;
            logger.info(`Getting last dump from: ${apiUrl}`);

            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${this.token}`
                }
            });

            if (response.status !== 200) {
                return this.createErrorResponse(`Failed to get last dump. Status: ${response.status}`);
            }

            const data = await response.json();
            if (Array.isArray(data.data) && data.data.length > 0) {
                await this.catalogService.addFiles(data.data);
            }
            return this.createSuccessResponse(data.data || [], 'Last dump retrieved successfully');
        } catch (error) {
            logger.error(`Error getting last dump: ${error}`);
            return this.createErrorResponse(`Failed to get last dump: ${error}`);
        }
    }

    async uploads(files: { filepath: string; file?: Buffer<ArrayBufferLike>; metadata?: Partial<IFile> }[]): Promise<IStorageResponse> {
        return this.createErrorResponse('Method uploads not implemented in DistantBackendStorage');
    }

    async deleteFiles(files: { filepath: string }[]): Promise<IStorageResponse> {
        return this.createErrorResponse('Method deleteFiles not implemented in DistantBackendStorage');
    }
}
