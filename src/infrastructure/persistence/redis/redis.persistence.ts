import app from '../../../api/app';
import { ICatalogResponse, ICatalogResponseMulti } from '../../../core/interfaces/Icatalog';
import { IFile } from '../../../core/interfaces/Ifile';
import { ApiResponse } from '../../../core/models/response.model';
import { getCurrentDateVersion } from '../../../utils/date';
import { logger } from '../../../utils/logs/winston';
import { BasePersistence } from '../basePersistence';
import { validateFileForAdd } from '../validators/file.validator';
import { redisHandler } from './connection';

export class RedisCatalogRepository extends BasePersistence {
    protected storageType = 'REDIS';
    private isConnected = false;
    private readonly catalogKey: string = 'catalog';

    constructor() {
        super();
        this.initCatalogIfEmpty();
    }

    private async initCatalogIfEmpty(): Promise<void> {
        try {
            await redisHandler.connectClient();
            const catalogData = await redisHandler.getAsync(this.catalogKey);
            if (!catalogData) {
                logger.info('Initializing empty catalog in Redis');
                await redisHandler.setAsync(this.catalogKey, JSON.stringify([]));
            }
        } catch (error) {
            logger.error(`Error initializing catalog: ${error}`);
        } finally {
            await redisHandler.disconnectClient();
        }
    }

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
            const catalogData = await redisHandler.getAsync(this.catalogKey);

            if (!catalogData) {
                await this.initCatalogIfEmpty();
                return ApiResponse.successMulti([]);
            }

            try {
                const files = JSON.parse(catalogData);
                return ApiResponse.successMulti(files);
            } catch (parseError) {
                logger.error(`Error parsing catalog data: ${parseError}`);
                return ApiResponse.errorMulti(`Failed to parse catalog data: ${parseError}`, []);
            }
        } catch (error) {
            logger.error(`Error getting catalog: ${error}`);
            return ApiResponse.errorMulti(`Failed to get catalog: ${error}`, []);
        }
    }

    async getByUuid(uuid: string): Promise<ICatalogResponse> {
        try {
            if (!uuid || typeof uuid !== 'string') {
                return this.createErrorResponse('Invalid UUID format', 400);
            }

            logger.info(`Getting file with UUID ${uuid} from Redis catalog`);
            await this.ensureConnected();
            const catalogData = await redisHandler.getAsync(this.catalogKey);

            if (!catalogData) {
                return ApiResponse.notFound(`File with UUID ${uuid} not found`);
            }

            const files = JSON.parse(catalogData);
            const file = files.find((f) => f.uuid === uuid);

            if (!file) {
                return ApiResponse.notFound(`File with UUID ${uuid} not found`);
            }

            return ApiResponse.successWithDatum(file);
        } catch (error) {
            logger.error(`Error getting file by UUID: ${error}`);
            return this.createErrorResponse(`Failed to get file: ${error}`);
        }
    }

    async add(file: IFile): Promise<ICatalogResponse> {
        try {
            logger.info(`Adding file ${file.filename} to Redis catalog`);

            const allFilesResponse = await this.getAll();
            const existingFiles = allFilesResponse.data || [];

            const validationErrors = validateFileForAdd(file, existingFiles);
            if (validationErrors) {
                logger.error(`Validation errors when adding file: ${JSON.stringify(validationErrors)}`);
                return this.createValidationErrorResponse(validationErrors);
            }

            await this.ensureConnected();
            const catalogData = await redisHandler.getAsync(this.catalogKey);

            let files = [];
            if (catalogData) {
                files = JSON.parse(catalogData);
            }

            if (file.uuid && files.some((f) => f.uuid === file.uuid)) {
                return ApiResponse.errorWithDatum(`File with UUID ${file.uuid} already exists`);
            }

            files.push(file);
            await redisHandler.setAsync(this.catalogKey, JSON.stringify(files));

            return ApiResponse.successWithDatum(file);
        } catch (error) {
            logger.error(`Error adding file to Redis: ${error}`);
            return this.createErrorResponse(`Failed to add file: ${error}`);
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

            const validationErrors = this.validateFilesBeforeAdd(files);
            if (validationErrors) {
                logger.error(`Validation errors when adding files: ${JSON.stringify(validationErrors)}`);
                return this.createMultiValidationErrorResponse(validationErrors);
            }

            await this.ensureConnected();
            const catalogData = await redisHandler.getAsync(this.catalogKey);

            let existingFiles = [];
            if (catalogData) {
                existingFiles = JSON.parse(catalogData);
            }

            const newFiles = [...existingFiles, ...files];
            await redisHandler.setAsync(this.catalogKey, JSON.stringify(newFiles));

            return ApiResponse.successMulti(files);
        } catch (error) {
            logger.error(`Error adding multiple files to Redis: ${error}`);
            return this.createMultiErrorResponse([`Failed to add files: ${error}`]);
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
            const catalogData = await redisHandler.getAsync(this.catalogKey);

            if (!catalogData) {
                return ApiResponse.notFound(`File with UUID ${uuid} not found`);
            }

            const files = JSON.parse(catalogData);
            const fileIndex = files.findIndex((f) => f.uuid === uuid);

            if (fileIndex === -1) {
                return ApiResponse.notFound(`File with UUID ${uuid} not found`);
            }

            const updatedFile = { ...files[fileIndex], ...fileData };
            files[fileIndex] = updatedFile;

            await redisHandler.setAsync(this.catalogKey, JSON.stringify(files));

            return ApiResponse.successWithDatum(updatedFile);
        } catch (error) {
            logger.error(`Error updating file in Redis: ${error}`);
            return this.createErrorResponse(`Failed to update file: ${error}`);
        }
    }

    async delete(uuid: string): Promise<void> {
        try {
            if (!uuid || typeof uuid !== 'string') {
                return;
            }

            logger.info(`Deleting file with UUID ${uuid} from Redis catalog`);
            await this.ensureConnected();
            const catalogData = await redisHandler.getAsync(this.catalogKey);

            if (!catalogData) {
                return;
            }

            const files = JSON.parse(catalogData);
            const fileIndex = files.findIndex((f) => f.uuid === uuid);

            if (fileIndex === -1) {
                return;
            }

            files.splice(fileIndex, 1);
            await redisHandler.setAsync(this.catalogKey, JSON.stringify(files));
        } catch (error) {
            logger.error(`Error deleting file from Redis: ${error}`);
            throw error;
        }
    }

    async deleteAll(): Promise<ICatalogResponseMulti> {
        try {
            logger.info('Deleting all files from Redis catalog');
            await this.ensureConnected();
            await redisHandler.setAsync(this.catalogKey, JSON.stringify([]));
            return ApiResponse.successMulti([]);
        } catch (error) {
            logger.error(`Error deleting all files from Redis: ${error}`);
            return this.createMultiErrorResponse([`Failed to delete all files: ${error}`]);
        }
    }

    async createDump(): Promise<{ status: number; data: string[]; errors: string[] }> {
        try {
            logger.info('Creating dump of Redis catalog');
            const fileVersion = getCurrentDateVersion();
            const filesResponse = await this.getAll();

            if (filesResponse.status !== 200 || !filesResponse.data) {
                return {
                    status: filesResponse.status,
                    data: [],
                    errors: filesResponse.errors || []
                };
            }

            const filePath = `${app.locals.PREFIXED_CATALOG}/${fileVersion}.json`;

            const postBackupFileJson = await fetch(`${app.locals.PREFIXED_API_URL}/delegated-storage?filepath=${filePath}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(filesResponse.data)
            });

            if (postBackupFileJson.status !== 200) {
                return {
                    status: 500,
                    data: [],
                    errors: ['Failed to upload JSON in backup']
                };
            }

            return {
                status: 200,
                data: filesResponse.data.map((file) => JSON.stringify(file)),
                errors: []
            };
        } catch (error) {
            logger.error(`Error creating dump: ${error}`);
            return {
                status: 500,
                data: [],
                errors: [`Failed to create dump: ${error}`]
            };
        }
    }

    async find(id: string): Promise<IFile | null> {
        const response = await this.getByUuid(id);
        return response.datum || null;
    }

    async findAll(): Promise<IFile[]> {
        const response = await this.getAll();
        return response.data || [];
    }

    async save(file: IFile): Promise<IFile> {
        const response = await this.add(file);
        return response.datum;
    }
}
