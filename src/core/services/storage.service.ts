import { StorageResponse } from '../../infrastructure/storage/baseStorage';
import { StorageFactory } from '../../infrastructure/storage/factory';
import { logger } from '../../utils/logs/winston';
import { IStorage } from '../interfaces/Istorage';

export class StorageService {
    private storage: IStorage;

    constructor(storage?: IStorage) {
        this.storage = storage || StorageFactory.createStorage();
    }

    async getFile(filepath: string): Promise<StorageResponse> {
        try {
            logger.info(`Getting file: ${filepath}`);
            const response = await this.storage.getFile(filepath);
            return {
                status: 200,
                data: response,
                message: 'File retrieved successfully'
            };
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
            const buffer = Buffer.isBuffer(file) ? file : Buffer.from(file);
            const response = await this.storage.uploadFile(buffer, { filename: filepath });
            return {
                status: response.success ? 200 : 500,
                message: response.error || 'File uploaded successfully',
                data: response.file
            };
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
            const responses = await Promise.all(filesPaths.map((filepath, index) => this.uploadFile(filepath, files[index])));
            return {
                status: 200,
                data: responses,
                message: 'Files uploaded successfully'
            };
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
            const buffer = Buffer.isBuffer(file) ? file : Buffer.from(file);
            const response = await this.storage.uploadFile(buffer, { filename: filepath });
            return {
                status: response.success ? 200 : 500,
                message: response.error || 'File updated successfully',
                data: response.file
            };
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
            const responses = await Promise.all(filesPaths.map((filepath, index) => this.updateFile(filepath, files[index])));
            return {
                status: 200,
                data: responses,
                message: 'Files updated successfully'
            };
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
            const response = await this.storage.deleteFile(filepath);
            return {
                status: response ? 200 : 500,
                message: response ? 'File deleted successfully' : 'Failed to delete file',
                data: response
            };
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
            const responses = await Promise.all(filesPaths.map((filepath) => this.deleteFile(filepath)));
            return {
                status: 200,
                data: responses,
                message: 'Files deleted successfully'
            };
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
            const response = await this.storage.getLastDump();
            return {
                status: 200,
                data: response,
                message: 'Last dump retrieved successfully'
            };
        } catch (error) {
            logger.error(`Error in StorageService.getLastDump: ${error}`);
            return {
                status: 500,
                message: `Failed to get last dump: ${error}`
            };
        }
    }
}
