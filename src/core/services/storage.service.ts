import { BaseStorage, StorageFileProps, StorageFilesProps, StorageResponse } from '../../infrastructure/storage/baseStorage';
import { StorageFactory } from '../../infrastructure/storage/factory';
import { logger } from '../../utils/logs/winston';

export class StorageService {
    private storage: BaseStorage;

    constructor(storage?: BaseStorage) {
        // If storage is not provided, create one using factory
        this.storage = storage || StorageFactory.createStorage();
    }

    async getFile(filepath: string): Promise<StorageResponse> {
        try {
            logger.info(`Getting file: ${filepath}`);
            return await this.storage.getFile({ filepath });
        } catch (error) {
            logger.error(`Error in StorageService.getFile: ${error}`);
            return {
                status: 500,
                message: `Failed to get file: ${error}`
            };
        }
    }

    async uploadFile(filepath: string, file: Buffer | string): Promise<StorageResponse> {
        try {
            logger.info(`Uploading file: ${filepath}`);
            return await this.storage.upload({ filepath, file });
        } catch (error) {
            logger.error(`Error in StorageService.uploadFile: ${error}`);
            return {
                status: 500,
                message: `Failed to upload file: ${error}`
            };
        }
    }

    async uploadFiles(filesPaths: string[], files: Array<Buffer | string>): Promise<StorageResponse> {
        try {
            logger.info(`Uploading ${filesPaths.length} files`);
            return await this.storage.uploads({ filespath: filesPaths, files });
        } catch (error) {
            logger.error(`Error in StorageService.uploadFiles: ${error}`);
            return {
                status: 500,
                message: `Failed to upload files: ${error}`
            };
        }
    }

    async updateFile(filepath: string, file: Buffer | string): Promise<StorageResponse> {
        try {
            logger.info(`Updating file: ${filepath}`);
            return await this.storage.update({ filepath, file });
        } catch (error) {
            logger.error(`Error in StorageService.updateFile: ${error}`);
            return {
                status: 500,
                message: `Failed to update file: ${error}`
            };
        }
    }

    async updateFiles(filesPaths: string[], files: Array<Buffer | string>): Promise<StorageResponse> {
        try {
            logger.info(`Updating ${filesPaths.length} files`);
            return await this.storage.updates({ filespath: filesPaths, files });
        } catch (error) {
            logger.error(`Error in StorageService.updateFiles: ${error}`);
            return {
                status: 500,
                message: `Failed to update files: ${error}`
            };
        }
    }

    async deleteFile(filepath: string): Promise<StorageResponse> {
        try {
            logger.info(`Deleting file: ${filepath}`);
            return await this.storage.delete({ filepath });
        } catch (error) {
            logger.error(`Error in StorageService.deleteFile: ${error}`);
            return {
                status: 500,
                message: `Failed to delete file: ${error}`
            };
        }
    }

    async deleteFiles(filesPaths: string[]): Promise<StorageResponse> {
        try {
            logger.info(`Deleting ${filesPaths.length} files`);
            return await this.storage.deleteFiles({ filespath: filesPaths });
        } catch (error) {
            logger.error(`Error in StorageService.deleteFiles: ${error}`);
            return {
                status: 500,
                message: `Failed to delete files: ${error}`
            };
        }
    }

    async getLastDump(): Promise<StorageResponse> {
        try {
            logger.info('Getting last dump');
            return await this.storage.getLastDump();
        } catch (error) {
            logger.error(`Error in StorageService.getLastDump: ${error}`);
            return {
                status: 500,
                message: `Failed to get last dump: ${error}`
            };
        }
    }
}
