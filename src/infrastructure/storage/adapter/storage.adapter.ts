import { IFile } from '../../../core/interfaces/Ifile';
import { IStorage, IStorageResponse } from '../../../core/interfaces/Istorage';
import { logger } from '../../../utils/logs/winston';
import { BaseStorage } from '../baseStorage';

export class StorageAdapter implements IStorage {
    private baseStorage: BaseStorage;
    private storageMethod: string;

    constructor(baseStorage: BaseStorage) {
        this.baseStorage = baseStorage;
        this.storageMethod = (process.env.DELEGATED_STORAGE_METHOD || 'STANDALONE').toUpperCase();
    }

    async uploadFile(fileBuffer: Buffer, metadata: Partial<IFile>): Promise<IStorageResponse> {
        try {
            const filepath = metadata.unique_name || metadata.filename || '';
            logger.info(`StorageAdapter: Uploading file ${filepath} with metadata: ${JSON.stringify(metadata)}`);

            const storageMetadata = {
                ...metadata,
                destination: metadata.destination || '',
                filename: metadata.filename || filepath.split('/').pop() || 'file',
                mimetype: metadata.mimetype || 'application/octet-stream',
                size: fileBuffer.length,
                namespace: metadata.namespace || 'default',
                version: metadata.version || 1
            };

            const cleanMetadata = { ...storageMetadata };
            delete cleanMetadata.toWebp;

            const response = await this.baseStorage.upload({
                filepath,
                file: fileBuffer,
                metadata: cleanMetadata
            });

            logger.info(`Storage response status: ${response.status}`);

            if (response.status >= 400) {
                return {
                    success: false,
                    error: response.message || `Failed with status ${response.status}`,
                    file: null
                };
            }

            if (!metadata.public_url) {
                const baseUrl = process.env.NGINX_INGRESS || 'http://localhost:8080';
                metadata.public_url = `${baseUrl}/assets/media/full${filepath}`;
            }

            return {
                success: response.status >= 200 && response.status < 300,
                file: metadata as IFile,
                error: response.status >= 400 ? response.message : undefined
            };
        } catch (error) {
            logger.error(`Error in storage adapter uploadFile: ${error}`);
            return {
                success: false,
                error: `Error uploading file: ${error}`,
                file: null
            };
        }
    }

    async getFile(identifier: string): Promise<Buffer | null> {
        try {
            const response = await this.baseStorage.getFile({ filepath: identifier });

            if (response.status !== 200 || !response.data) {
                return null;
            }

            // Handle different types of data that might be returned
            if (Buffer.isBuffer(response.data)) {
                return response.data;
            } else if (response.data.body && typeof response.data.pipe === 'function') {
                // Handle stream
                return await this.streamToBuffer(response.data);
            }

            return null;
        } catch (error) {
            logger.error(`Error in storage adapter getFile: ${error}`);
            return null;
        }
    }

    async deleteFile(identifier: string): Promise<boolean> {
        try {
            const response = await this.baseStorage.delete({ filepath: identifier });
            return response.status >= 200 && response.status < 300;
        } catch (error) {
            logger.error(`Error in storage adapter deleteFile: ${error}`);
            return false;
        }
    }

    getPublicUrl(identifier: string): string | null {
        try {
            const baseUrl = process.env.NGINX_INGRESS || '';
            if (!baseUrl) return null;

            return `${baseUrl}/assets/media/full${identifier}`;
        } catch (error) {
            logger.error(`Error in storage adapter getPublicUrl: ${error}`);
            return null;
        }
    }

    async getLastDump(): Promise<IFile[]> {
        try {
            const response = await this.baseStorage.getLastDump();

            if (response.status !== 200 || !response.data) {
                return [];
            }

            return Array.isArray(response.data) ? response.data : [];
        } catch (error) {
            logger.error(`Error in storage adapter getLastDump: ${error}`);
            return [];
        }
    }

    private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
        return new Promise<Buffer>((resolve, reject) => {
            const chunks: Buffer[] = [];

            stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
            stream.on('error', (err) => reject(err));
        });
    }
}
