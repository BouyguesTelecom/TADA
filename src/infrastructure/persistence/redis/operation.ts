import { ICatalogResponse, ICatalogResponseMulti } from '../../../core/interfaces/Icatalog';
import { IFile } from '../../../core/interfaces/Ifile';
import { File } from '../../../core/models/file.model';
import { ApiResponse } from '../../../core/models/response.model';
import { logger } from '../../../utils/logs/winston';
import { validateFileBeforeUpdate, validateFiles } from '../validators/file.validator';
import { redisHandler } from './connection';

export class RedisOperations {
    public static async getOneFile(id: string): Promise<ICatalogResponse> {
        try {
            await redisHandler.connectClient();
            const file = await redisHandler.getAsync(id);

            if (!file) {
                return ApiResponse.notFound(`File with ID ${id} not found`);
            }

            try {
                const parsedFile = JSON.parse(file);
                return ApiResponse.successWithDatum(new File(parsedFile));
            } catch (parseError) {
                logger.error(`Error parsing file data: ${parseError}`);
                return ApiResponse.errorWithDatum(`Error parsing file data: ${parseError}`);
            }
        } catch (err) {
            logger.error(`Error getting file: ${err}`);
            return ApiResponse.errorWithDatum(`Error getting file: ${err}`);
        }
    }

    public static async getAllFiles(): Promise<ICatalogResponseMulti> {
        try {
            await redisHandler.connectClient();
            const ids = await redisHandler.keysAsync('*');
            const files: IFile[] = [];

            if (ids && ids.length) {
                for (const id of ids) {
                    const file = await redisHandler.getAsync(id);
                    if (file) {
                        try {
                            const parsedFile = JSON.parse(file);
                            files.push(new File(parsedFile));
                        } catch (parseError) {
                            logger.error(`Error parsing file data: ${parseError}`);
                        }
                    }
                }
            }

            return ApiResponse.successMulti(files);
        } catch (err) {
            logger.error(`Error listing items: ${err}`);
            return ApiResponse.errorMulti(`Error listing items: ${err}`, []);
        }
    }

    public static async filePathIsUnique(file: IFile): Promise<boolean> {
        const allFilesResponse = await this.getAllFiles();
        if (allFilesResponse.status !== 200 || !allFilesResponse.data) {
            return true;
        }

        const existingFile = allFilesResponse.data.find((existingFile) => existingFile.unique_name === file.unique_name);

        return !existingFile;
    }

    public static async addOneFile(file: IFile): Promise<ICatalogResponse> {
        try {
            // Check if file has required properties
            if (!file.uuid || !file.filename || !file.namespace || !file.unique_name) {
                return ApiResponse.validationError('Missing required file properties (uuid, filename, namespace, unique_name)');
            }

            if (!(await this.filePathIsUnique(file))) {
                return ApiResponse.errorWithDatum(`File with path ${file.unique_name} already exists in namespace ${file.namespace}`);
            }

            const validationErrors = validateFileBeforeUpdate(file);
            if (validationErrors) {
                return ApiResponse.validationError(`File validation failed: ${JSON.stringify(validationErrors)}`);
            }

            await redisHandler.connectClient();
            await redisHandler.setAsync(file.uuid, JSON.stringify(file));

            const uploadedFile = await this.getOneFile(file.uuid);
            if (uploadedFile.status === 200 && uploadedFile.datum) {
                return ApiResponse.successWithDatum(uploadedFile.datum);
            }

            return ApiResponse.errorWithDatum(`Unable to retrieve file with id ${file.uuid} after adding it`);
        } catch (err) {
            logger.error(`Error adding item: ${err}`);
            return ApiResponse.errorWithDatum(`Error adding item: ${err}`);
        }
    }

    public static async addMultipleFiles(files: IFile[]): Promise<ICatalogResponseMulti> {
        try {
            const validationErrors = validateFiles(files);
            if (validationErrors) {
                return ApiResponse.errorMulti(`Files validation failed: ${JSON.stringify(validationErrors)}`, []);
            }

            const successfulUploadFiles: IFile[] = [];
            const failedUploadFiles: string[] = [];

            for (const file of files) {
                const response = await this.addOneFile(file);
                if (response.status === 201 && response.datum) {
                    successfulUploadFiles.push(response.datum);
                } else {
                    failedUploadFiles.push(response.error || 'Unknown error');
                }
            }

            if (failedUploadFiles.length === 0) {
                return ApiResponse.successMulti(successfulUploadFiles);
            } else if (successfulUploadFiles.length === 0) {
                return ApiResponse.errorMulti(`Files validation failed: ${JSON.stringify(validationErrors)}`, failedUploadFiles);
            } else {
                // Some succeeded, some failed
                return ApiResponse.errorMulti(`Files validation failed: ${JSON.stringify(validationErrors)}`, failedUploadFiles);
            }
        } catch (err) {
            logger.error(`Error adding items: ${err}`);
            return ApiResponse.errorMulti(`Error adding items: ${err}`, []);
        }
    }

    public static async updateOneFile(fileId: string, updateData: Partial<IFile>): Promise<ICatalogResponse> {
        try {
            await redisHandler.connectClient();
            const existingFileData = await redisHandler.getAsync(fileId);

            if (!existingFileData) {
                return ApiResponse.notFound(`File with id ${fileId} does not exist`);
            }

            try {
                const existingFile = JSON.parse(existingFileData);
                const updatedFile = { ...existingFile, ...updateData };

                await redisHandler.setAsync(fileId, JSON.stringify(updatedFile));

                return ApiResponse.successWithDatum(new File(updatedFile));
            } catch (parseError) {
                return ApiResponse.errorWithDatum(`Error parsing file data: ${parseError}`);
            }
        } catch (err) {
            return ApiResponse.errorWithDatum(`Error updating file: ${err}`);
        }
    }

    public static async deleteOneFile(id: string): Promise<ICatalogResponse> {
        try {
            await redisHandler.connectClient();
            const existingFileData = await redisHandler.getAsync(id);

            if (!existingFileData) {
                return ApiResponse.notFound(`File with id ${id} does not exist`);
            }

            let fileToDelete: IFile;
            try {
                fileToDelete = JSON.parse(existingFileData);
            } catch (parseError) {
                return ApiResponse.errorWithDatum(`Error parsing file data: ${parseError}`);
            }

            await redisHandler.delAsync(id);

            return ApiResponse.successWithDatum(fileToDelete);
        } catch (err) {
            return ApiResponse.errorWithDatum(`Error deleting file: ${err}`);
        }
    }

    public static async cleanCatalog(): Promise<void> {
        await redisHandler.connectClient();

        await redisHandler.delAsync('catalog');

        await redisHandler.setAsync('catalog', JSON.stringify([]));
    }

    public static async getCatalog(): Promise<ICatalogResponseMulti> {
        return await this.getAllFiles();
    }
}
