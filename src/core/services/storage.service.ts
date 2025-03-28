import { logger } from '../../utils/logs/winston';
import { IStorage } from '../interfaces/Istorage';
import { StorageFactory } from '../models/storage.model';

export class StorageService {
    private storage: IStorage;

    constructor(storage?: IStorage) {
        this.storage = storage || StorageFactory.create();
    }

    async getFile(filepath: string) {
        try {
            logger.info(`Getting file: ${filepath}`);
            return await this.storage.getFile(filepath);
        } catch (error) {
            logger.error(`Error in StorageService.getFile: ${error}`);
            return {
                status: 500,
                data: null,
                message: `Failed to get file: ${error}`
            };
        }
    }

    async uploadFile(filepath: string, file: Buffer | string, metadata?: any) {
        try {
            logger.info(`Uploading file: ${filepath}`);
            const buffer = Buffer.isBuffer(file) ? file : Buffer.from(file);
            return await this.storage.uploadFile(buffer, {
                unique_name: filepath,
                ...metadata
            });
        } catch (error) {
            logger.error(`Error in StorageService.uploadFile: ${error}`);
            return {
                status: 500,
                data: null,
                message: `Failed to upload file: ${error}`
            };
        }
    }

    async uploadFiles(files: Array<{ filepath: string; file: Buffer | string; metadata?: any }>) {
        try {
            logger.info(`Uploading ${files.length} files`);
            return await this.storage.uploads(
                files.map((f) => ({
                    filepath: f.filepath,
                    file: Buffer.isBuffer(f.file) ? f.file : Buffer.from(f.file),
                    metadata: f.metadata
                }))
            );
        } catch (error) {
            logger.error(`Error in StorageService.uploadFiles: ${error}`);
            return {
                status: 500,
                data: null,
                message: `Failed to upload files: ${error}`
            };
        }
    }

    async deleteFile(filepath: string) {
        try {
            logger.info(`Deleting file: ${filepath}`);
            return await this.storage.deleteFile(filepath);
        } catch (error) {
            logger.error(`Error in StorageService.deleteFile: ${error}`);
            return {
                status: 500,
                data: null,
                message: `Failed to delete file: ${error}`
            };
        }
    }

    async deleteFiles(files: Array<{ filepath: string }>) {
        try {
            logger.info(`Deleting ${files.length} files`);
            return await this.storage.deleteFiles(files);
        } catch (error) {
            logger.error(`Error in StorageService.deleteFiles: ${error}`);
            return {
                status: 500,
                data: null,
                message: `Failed to delete files: ${error}`
            };
        }
    }

    async getLastDump() {
        try {
            logger.info('Getting last dump');
            return await this.storage.getLastDump();
        } catch (error) {
            logger.error(`Error in StorageService.getLastDump: ${error}`);
            return {
                status: 500,
                data: null,
                message: `Failed to get last dump: ${error}`
            };
        }
    }
}
