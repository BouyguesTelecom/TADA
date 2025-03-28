import { IFile } from '../../core/interfaces/Ifile';
import { IStorage, IStorageResponse } from '../../core/interfaces/Istorage';
import { logger } from '../../utils/logs/winston';
import { StorageUtils } from '../../utils/storage.utils';

export interface StorageFileProps {
    filepath: string;
    file?: Buffer;
    metadata?: {
        unique_name?: string;
        base_url?: string;
        destination?: string;
        filename?: string;
        mimetype?: string;
        size?: number;
        namespace?: string;
        version?: number;
        [key: string]: any;
    };
}

export interface StorageFilesProps {
    files: StorageFileProps[];
}

export abstract class BaseStorage implements IStorage {
    protected storageType: string;

    constructor(storageType: string) {
        this.storageType = storageType;
    }

    protected createSuccessResponse(data: any = null, message?: string): IStorageResponse {
        return {
            success: true,
            data,
            message,
            file: null
        };
    }

    protected createErrorResponse(error: string, data: any = null): IStorageResponse {
        return {
            success: false,
            error,
            data,
            file: null
        };
    }

    protected createNotFoundResponse(filepath: string): IStorageResponse {
        return {
            success: false,
            error: `File not found: ${filepath}`,
            file: null
        };
    }

    async uploadFile(fileBuffer: Buffer, metadata: Partial<IFile>): Promise<IStorageResponse> {
        try {
            const filepath = metadata.unique_name || metadata.filename || '';
            logger.info(`Uploading file ${filepath} with metadata: ${JSON.stringify(metadata)}`);

            const storageMetadata = StorageUtils.prepareMetadata(fileBuffer, metadata);
            const props: StorageFileProps = {
                filepath,
                file: fileBuffer,
                metadata: storageMetadata
            };

            const validationError = StorageUtils.validateFileProps(props);
            if (validationError) {
                return this.createErrorResponse(validationError);
            }

            const response = await this.upload(props);
            if (!response.success) {
                return this.createErrorResponse(response.error || 'Upload failed');
            }

            if (!metadata.public_url) {
                metadata.public_url = StorageUtils.generatePublicUrl(filepath);
            }

            return this.createSuccessResponse(null, 'File uploaded successfully');
        } catch (error) {
            logger.error(`Error in storage uploadFile: ${error}`);
            return this.createErrorResponse(`Error uploading file: ${error}`);
        }
    }

    async getFile(identifier: string): Promise<IStorageResponse> {
        try {
            const response = await this.getFileFromStorage({ filepath: identifier });
            if (!response.success) {
                return this.createErrorResponse(response.error || 'File not found');
            }

            return this.createSuccessResponse(response.data);
        } catch (error) {
            logger.error(`Error in storage getFile: ${error}`);
            return this.createErrorResponse(`Failed to get file: ${error}`);
        }
    }

    async deleteFile(identifier: string): Promise<IStorageResponse> {
        try {
            const response = await this.deleteFromStorage({ filepath: identifier });
            return {
                success: response.success,
                error: response.error,
                file: null
            };
        } catch (error) {
            logger.error(`Error in storage deleteFile: ${error}`);
            return this.createErrorResponse(`Failed to delete file: ${error}`);
        }
    }

    getPublicUrl(identifier: string): string | null {
        try {
            return StorageUtils.generatePublicUrl(identifier);
        } catch (error) {
            logger.error(`Error in storage getPublicUrl: ${error}`);
            return null;
        }
    }

    async getLastDump(): Promise<IStorageResponse> {
        try {
            const response = await this.getLastDumpFromStorage();
            return {
                success: response.success,
                data: response.data,
                error: response.error
            };
        } catch (error) {
            logger.error(`Error in storage getLastDump: ${error}`);
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

                const response = await this.uploadFile(file.file, {
                    unique_name: file.filepath,
                    ...file.metadata
                });

                if (response.success) {
                    results.push(file.filepath);
                } else {
                    errors.push(file.filepath);
                }
            }

            return this.createSuccessResponse({ success: results, errors }, `Uploaded ${results.length} files, failed ${errors.length} files`);
        } catch (error) {
            logger.error(`Error in storage uploads: ${error}`);
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
                const response = await this.deleteFile(file.filepath);
                if (response.success) {
                    results.push(file.filepath);
                } else {
                    errors.push(file.filepath);
                }
            }

            return this.createSuccessResponse({ success: results, errors }, `Deleted ${results.length} files, failed ${errors.length} files`);
        } catch (error) {
            logger.error(`Error in storage deleteFiles: ${error}`);
            return this.createErrorResponse(`Delete operation failed: ${error}`);
        }
    }

    protected abstract getFileFromStorage(props: StorageFileProps): Promise<IStorageResponse>;
    protected abstract upload(props: StorageFileProps): Promise<IStorageResponse>;
    protected abstract deleteFromStorage(props: StorageFileProps): Promise<IStorageResponse>;
    protected abstract getLastDumpFromStorage(): Promise<IStorageResponse>;
}
