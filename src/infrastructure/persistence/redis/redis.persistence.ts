import { BasePersistence } from '../basePersistence';
import { ICatalogResponse, ICatalogResponseMulti } from '../../../core/interfaces/Icatalog';
import { IFile } from '../../../core/interfaces/Ifile';
import { File } from '../../../core/models/file.model';
import { logger } from '../../../utils/logs/winston';
import { redisHandler } from './connection';
import { RedisOperations } from './operation';
import { getCurrentDateVersion } from '../../../utils/date';
import { validateFileForAdd } from '../validators/file.validator';
import app from '../../../api/app';

export class RedisCatalogRepository extends BasePersistence {
    protected storageType = 'REDIS';
    private isConnected = false;

    private async ensureConnected(): Promise<void> {
        if (!this.isConnected) {
            await redisHandler.connectClient();
            this.isConnected = true;
        }
    }

    public async disconnect(): Promise<void> {
        if (this.isConnected) {
            await redisHandler.disconnectClient();
            this.isConnected = false;
        }
    }

    async getAll(): Promise<ICatalogResponseMulti> {
        try {
            logger.info('Getting all files from Redis catalog');

            await this.ensureConnected();

            const result = await RedisOperations.getAllFiles();
            return result;
        } catch (error) {
            logger.error(`Error getting all files from Redis: ${error}`);
            return this.createMultiErrorResponse([`Failed to get catalog from Redis: ${error}`]);
        }
    }

    async getByUuid(uuid: string): Promise<ICatalogResponse> {
        try {
            if (!uuid || typeof uuid !== 'string') {
                return this.createErrorResponse('Invalid UUID format', 400);
            }

            logger.info(`Getting file with UUID ${uuid} from Redis catalog`);

            await this.ensureConnected();

            const result = await RedisOperations.getOneFile(uuid);
            return result;
        } catch (error) {
            logger.error(`Error getting file from Redis: ${error}`);
            return this.createErrorResponse(`Failed to get file from Redis: ${error}`);
        }
    }

    async add(file: IFile): Promise<ICatalogResponse> {
        try {
            logger.info(`Adding file ${file.filename} to Redis catalog`);

            // Get all files for validation
            const allFilesResponse = await this.getAll();
            const existingFiles = allFilesResponse.data || [];

            // Validate file
            const validationErrors = validateFileForAdd(file, existingFiles);
            if (validationErrors) {
                logger.error(`Validation errors when adding file: ${JSON.stringify(validationErrors)}`);
                return this.createValidationErrorResponse(validationErrors);
            }

            await this.ensureConnected();

            const result = await RedisOperations.addOneFile(file);
            return result;
        } catch (error) {
            logger.error(`Error adding file to Redis: ${error}`);
            return this.createErrorResponse(`Failed to add file to Redis: ${error}`);
        }
    }

    async addMany(files: IFile[]): Promise<ICatalogResponseMulti> {
        try {
            logger.info(`Adding ${files.length} files to Redis catalog`);

            if (!Array.isArray(files)) {
                return this.createMultiErrorResponse(['Input must be an array of files']);
            }

            if (files.length === 0) {
                return this.createMultiErrorResponse(['No files provided for addition']);
            }

            // Validate files
            const validationErrors = this.validateFilesBeforeAdd(files);
            if (validationErrors) {
                logger.error(`Validation errors when adding files: ${JSON.stringify(validationErrors)}`);
                return this.createMultiValidationErrorResponse(validationErrors);
            }

            await this.ensureConnected();

            const result = await RedisOperations.addMultipleFiles(files);
            return result;
        } catch (error) {
            logger.error(`Error adding multiple files to Redis: ${error}`);
            return this.createMultiErrorResponse([`Failed to add files to Redis: ${error}`]);
        }
    }

    async update(uuid: string, fileData: Partial<IFile>): Promise<ICatalogResponse> {
        try {
            if (!uuid || typeof uuid !== 'string') {
                return this.createErrorResponse('Invalid UUID format', 400);
            }

            const validationErrors = this.validateFileBeforeUpdate(fileData);
            if (validationErrors) {
                logger.error(`Validation errors when updating file: ${JSON.stringify(validationErrors)}`);
                return this.createValidationErrorResponse(validationErrors);
            }

            logger.info(`Updating file with UUID ${uuid} in Redis catalog`);

            await this.ensureConnected();

            const result = await RedisOperations.updateOneFile(uuid, fileData);
            return result;
        } catch (error) {
            logger.error(`Error updating file in Redis: ${error}`);
            return this.createErrorResponse(`Failed to update file in Redis: ${error}`);
        }
    }

    async delete(uuid: string): Promise<ICatalogResponse> {
        try {
            if (!uuid || typeof uuid !== 'string') {
                return this.createErrorResponse('Invalid UUID format', 400);
            }

            logger.info(`Deleting file with UUID ${uuid} from Redis catalog`);

            await this.ensureConnected();

            const result = await RedisOperations.deleteOneFile(uuid);
            return result;
        } catch (error) {
            logger.error(`Error deleting file from Redis: ${error}`);
            return this.createErrorResponse(`Failed to delete file from Redis: ${error}`);
        }
    }

    async deleteAll(): Promise<ICatalogResponseMulti> {
        try {
            logger.info('Deleting all files from Redis catalog');

            const filesResponse = await this.getAll();

            if (filesResponse.status !== 200 || !filesResponse.data) {
                return filesResponse;
            }

            await this.ensureConnected();

            for (const file of filesResponse.data) {
                if (file.uuid) {
                    await redisHandler.delAsync(file.uuid);
                }
            }

            return this.createMultiSuccessResponse([]);
        } catch (error) {
            logger.error(`Error deleting all files from Redis: ${error}`);
            return this.createMultiErrorResponse([`Failed to delete all files from Redis: ${error}`]);
        }
    }

    async createDump(): Promise<ICatalogResponseMulti> {
        try {
            logger.info('Creating dump of Redis catalog');

            const fileVersion = getCurrentDateVersion();

            const filesResponse = await this.getAll();

            if (filesResponse.status !== 200 || !filesResponse.data) {
                return filesResponse;
            }

            const filePath = `${app.locals.PREFIXED_CATALOG}/${fileVersion}.json`;

            const postBackupFileJson = await fetch(`${app.locals.PREFIXED_API_URL}/delegated-storage?filepath=${filePath}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(filesResponse.data)
            });

            if (postBackupFileJson.status !== 200) {
                return this.createMultiErrorResponse(['Failed to upload JSON in backup']);
            }

            return {
                status: 200,
                data: [],
                errors: [`Dump created successfully at ${filePath}`]
            };
        } catch (error) {
            logger.error(`Error creating dump: ${error}`);
            return this.createMultiErrorResponse([`Failed to create dump: ${error}`]);
        }
    }
}
