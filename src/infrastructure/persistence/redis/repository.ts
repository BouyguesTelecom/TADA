import { ICatalogRepository, ICatalogResponse, ICatalogResponseMulti } from '../../../core/interfaces/Icatalog';
import { IFile } from '../../../core/interfaces/Ifile';
import { logger } from '../../../utils/logs/winston';
import { BasePersistence } from '../basePersistence';
import { redisHandler } from './connection';

export class RedisRepository extends BasePersistence implements ICatalogRepository {
    protected storageType: string = 'REDIS';
    private readonly catalogKey: string = 'catalog';

    constructor() {
        super();
        this.initCatalogIfEmpty();
    }

    private async initCatalogIfEmpty(): Promise<void> {
        try {
            await redisHandler.connectClient();

            // Check if catalog already exists
            const catalogData = await redisHandler.getAsync(this.catalogKey);
            if (!catalogData) {
                logger.info('Initializing empty catalog in Redis');
                // Init empty catalog
                await redisHandler.setAsync(this.catalogKey, JSON.stringify([]));
            }
        } catch (error) {
            logger.error(`Error initializing catalog: ${error}`);
        } finally {
            await redisHandler.disconnectClient();
        }
    }

    async getAll(): Promise<ICatalogResponseMulti> {
        try {
            await redisHandler.connectClient();
            const catalogData = await redisHandler.getAsync(this.catalogKey);

            if (!catalogData) {
                await this.initCatalogIfEmpty();
                return {
                    status: 200,
                    data: [],
                    errors: null
                };
            }
            try {
                const files = JSON.parse(catalogData);
                return {
                    status: 200,
                    data: files,
                    errors: null
                };
            } catch (parseError) {
                logger.error(`Error parsing catalog data: ${parseError}`);
                return {
                    status: 500,
                    data: null,
                    errors: [`Failed to parse catalog data: ${parseError}`]
                };
            }
        } catch (error) {
            logger.error(`Error getting catalog: ${error}`);
            return {
                status: 500,
                data: null,
                errors: [`Failed to get catalog: ${error}`]
            };
        } finally {
            await redisHandler.disconnectClient();
        }
    }

    async getByUuid(uuid: string): Promise<ICatalogResponse> {
        try {
            await redisHandler.connectClient();
            const catalogData = await redisHandler.getAsync(this.catalogKey);

            if (!catalogData) {
                return {
                    status: 404,
                    datum: null,
                    error: `File with UUID ${uuid} not found`
                };
            }

            const files = JSON.parse(catalogData);
            const file = files.find((f) => f.uuid === uuid);

            if (!file) {
                return {
                    status: 404,
                    datum: null,
                    error: `File with UUID ${uuid} not found`
                };
            }

            return {
                status: 200,
                datum: file,
                error: null
            };
        } catch (error) {
            logger.error(`Error getting file by UUID from Redis: ${error}`);
            return {
                status: 500,
                datum: null,
                error: `Failed to get file: ${error}`
            };
        }
    }

    async add(file: IFile): Promise<ICatalogResponse> {
        try {
            const validationErrors = this.validateFilesBeforeAdd([file]);
            if (validationErrors) {
                return this.createValidationErrorResponse(validationErrors.join(', '));
            }

            await redisHandler.connectClient();
            const catalogData = await redisHandler.getAsync(this.catalogKey);

            let files = [];
            if (catalogData) {
                files = JSON.parse(catalogData);
            }

            if (file.uuid && files.some((f) => f.uuid === file.uuid)) {
                return {
                    status: 409,
                    datum: null,
                    error: `File with UUID ${file.uuid} already exists`
                };
            }

            files.push(file);
            await redisHandler.setAsync(this.catalogKey, JSON.stringify(files));

            return {
                status: 201,
                datum: file,
                error: null
            };
        } catch (error) {
            logger.error(`Error adding file to Redis: ${error}`);
            return {
                status: 500,
                datum: null,
                error: `Failed to add file: ${error}`
            };
        }
    }

    async addMany(files: IFile[]): Promise<ICatalogResponseMulti> {
        try {
            const validationErrors = this.validateFilesBeforeAdd(files);
            if (validationErrors) {
                return this.createMultiValidationErrorResponse(validationErrors);
            }

            await redisHandler.connectClient();
            const catalogData = await redisHandler.getAsync(this.catalogKey);

            let existingFiles = [];
            if (catalogData) {
                existingFiles = JSON.parse(catalogData);
            }

            const newFiles = [...existingFiles, ...files];
            await redisHandler.setAsync(this.catalogKey, JSON.stringify(newFiles));

            return {
                status: 201,
                data: files,
                errors: null
            };
        } catch (error) {
            logger.error(`Error adding multiple files to Redis: ${error}`);
            return {
                status: 500,
                data: null,
                errors: [`Failed to add files: ${error}`]
            };
        }
    }

    async update(uuid: string, fileData: Partial<IFile>): Promise<ICatalogResponse> {
        try {
            await redisHandler.connectClient();
            const catalogData = await redisHandler.getAsync(this.catalogKey);

            if (!catalogData) {
                return {
                    status: 404,
                    datum: null,
                    error: `File with UUID ${uuid} not found`
                };
            }

            const files = JSON.parse(catalogData);
            const fileIndex = files.findIndex((f) => f.uuid === uuid);

            if (fileIndex === -1) {
                return {
                    status: 404,
                    datum: null,
                    error: `File with UUID ${uuid} not found`
                };
            }

            const updatedFile = { ...files[fileIndex], ...fileData };
            files[fileIndex] = updatedFile;

            await redisHandler.setAsync(this.catalogKey, JSON.stringify(files));

            return {
                status: 200,
                datum: updatedFile,
                error: null
            };
        } catch (error) {
            logger.error(`Error updating file in Redis: ${error}`);
            return {
                status: 500,
                datum: null,
                error: `Failed to update file: ${error}`
            };
        }
    }

    async delete(uuid: string): Promise<ICatalogResponse> {
        try {
            await redisHandler.connectClient();
            const catalogData = await redisHandler.getAsync(this.catalogKey);

            if (!catalogData) {
                return {
                    status: 404,
                    datum: null,
                    error: `File with UUID ${uuid} not found`
                };
            }

            const files = JSON.parse(catalogData);
            const fileIndex = files.findIndex((f) => f.uuid === uuid);

            if (fileIndex === -1) {
                return {
                    status: 404,
                    datum: null,
                    error: `File with UUID ${uuid} not found`
                };
            }

            const deletedFile = files[fileIndex];
            files.splice(fileIndex, 1);

            await redisHandler.setAsync(this.catalogKey, JSON.stringify(files));

            return {
                status: 200,
                datum: deletedFile,
                error: null
            };
        } catch (error) {
            logger.error(`Error deleting file from Redis: ${error}`);
            return {
                status: 500,
                datum: null,
                error: `Failed to delete file: ${error}`
            };
        }
    }

    async deleteAll(): Promise<ICatalogResponseMulti> {
        try {
            logger.info('Deleting all files from Redis catalog');

            await redisHandler.connectClient();

            await redisHandler.setAsync(this.catalogKey, JSON.stringify([]));

            return {
                status: 200,
                data: [],
                errors: null
            };
        } catch (error) {
            logger.error(`Error deleting all files from Redis: ${error}`);
            return {
                status: 500,
                data: null,
                errors: [`Failed to delete files: ${error}`]
            };
        } finally {
            await redisHandler.disconnectClient();
        }
    }
    async createDump(): Promise<ICatalogResponseMulti> {
        try {
            const catalogResponse = await this.getAll();

            if (catalogResponse.status !== 200 || !catalogResponse.data) {
                return {
                    status: 500,
                    data: null,
                    errors: ['Failed to get catalog data for dump']
                };
            }

            return {
                status: 200,
                data: catalogResponse.data,
                errors: null
            };
        } catch (error) {
            logger.error(`Error creating dump in Redis: ${error}`);
            return {
                status: 500,
                data: null,
                errors: [`Failed to create dump: ${error}`]
            };
        }
    }
}
