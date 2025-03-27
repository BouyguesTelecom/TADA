import { ICatalogResponse, ICatalogResponseMulti } from '../../../core/interfaces/Icatalog';
import { IFile } from '../../../core/interfaces/Ifile';
import { ApiResponse } from '../../../core/models/response.model';
import { getCurrentDateVersion } from '../../../utils/date';
import { logger } from '../../../utils/logs/winston';
import { BasePersistence } from '../basePersistence';
import { validateFileForAdd } from '../validators/file.validator';
import { StandaloneOperations } from './operation';
import { StandaloneUtils } from './utils';

export class StandaloneCatalogRepository extends BasePersistence {
    protected storageType = 'STANDALONE';
    private catalogPath = '/tmp/standalone/catalog.json';

    constructor() {
        super();
        this.ensureCatalogDirectoryExists();
    }

    private ensureCatalogDirectoryExists(): void {
        try {
            StandaloneUtils.createFolder('');
            // Check if catalog file exists, if not create it
            if (!StandaloneUtils.fileExists(this.catalogPath)) {
                logger.info('Creating empty catalog.json file');
                StandaloneOperations.writeCatalog([]);
            }
        } catch (error) {
            logger.error(`Error ensuring catalog exists: ${error}`);
            throw new Error(`Failed to initialize catalog: ${error}`);
        }
    }

    async getAll(): Promise<ICatalogResponseMulti> {
        try {
            logger.info('Getting all files from standalone catalog');
            return StandaloneOperations.getAllFiles();
        } catch (error) {
            logger.error(`Error getting all files: ${error}`);
            return this.createMultiErrorResponse([`Failed to get catalog: ${error}`]);
        }
    }

    async getByUuid(uuid: string): Promise<ICatalogResponse> {
        try {
            if (!uuid || typeof uuid !== 'string') {
                return this.createErrorResponse('Invalid UUID format', 400);
            }

            logger.info(`Getting file with UUID ${uuid} from standalone catalog`);
            return StandaloneOperations.getOneFile(uuid);
        } catch (error) {
            logger.error(`Error getting file by UUID: ${error}`);
            return this.createErrorResponse(`Failed to get file: ${error}`);
        }
    }

    async add(file: IFile): Promise<ICatalogResponse> {
        try {
            logger.info(`Adding file ${file.filename} to standalone catalog`);

            if (!file || typeof file !== 'object') {
                logger.error('Invalid file object provided');
                return this.createErrorResponse('Invalid file object provided', 400);
            }

            const files = StandaloneOperations.readCatalog();

            // Validate file before adding
            const validationErrors = validateFileForAdd(file, files);
            if (validationErrors) {
                logger.error(`Validation errors when adding file: ${JSON.stringify(validationErrors)}`);
                return this.createValidationErrorResponse(validationErrors);
            }

            return StandaloneOperations.addOneFile(file);
        } catch (error) {
            logger.error(`Error adding file: ${error}`);
            return this.createErrorResponse(`Failed to add file: ${error}`);
        }
    }

    async addMany(files: IFile[]): Promise<ICatalogResponseMulti> {
        try {
            logger.info(`Adding ${files.length} files to standalone catalog`);

            if (!Array.isArray(files)) {
                return this.createMultiErrorResponse(['Input must be an array of files']);
            }

            if (files.length === 0) {
                return this.createMultiErrorResponse(['No files provided for addition']);
            }

            // Validate each file
            const validationErrors = this.validateFilesBeforeAdd(files);
            if (validationErrors) {
                logger.error(`Validation errors when adding files: ${JSON.stringify(validationErrors)}`);
                return this.createMultiValidationErrorResponse(validationErrors);
            }

            return StandaloneOperations.addMultipleFiles(files);
        } catch (error) {
            logger.error(`Error adding multiple files: ${error}`);
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

            logger.info(`Updating file with UUID ${uuid} in standalone catalog`);
            return StandaloneOperations.updateOneFile(uuid, fileData);
        } catch (error) {
            logger.error(`Error updating file: ${error}`);
            return this.createErrorResponse(`Failed to update file: ${error}`);
        }
    }

    async delete(uuid: string): Promise<ICatalogResponse> {
        try {
            if (!uuid || typeof uuid !== 'string') {
                return this.createErrorResponse('Invalid UUID format', 400);
            }

            logger.info(`Deleting file with UUID ${uuid} from standalone catalog`);
            return StandaloneOperations.deleteOneFile(uuid);
        } catch (error) {
            logger.error(`Error deleting file: ${error}`);
            return this.createErrorResponse(`Failed to delete file: ${error}`);
        }
    }

    async deleteAll(): Promise<ICatalogResponseMulti> {
        try {
            logger.info('Deleting all files from standalone catalog');
            return StandaloneOperations.deleteAllFiles();
        } catch (error) {
            logger.error(`Error deleting all files: ${error}`);
            return this.createMultiErrorResponse([`Failed to delete all files: ${error}`]);
        }
    }

    async createDump(): Promise<ICatalogResponseMulti> {
        try {
            logger.info('Creating dump of standalone catalog');
            const fileVersion = getCurrentDateVersion();
            return StandaloneOperations.createCatalogDump(fileVersion);
        } catch (error) {
            logger.error(`Error creating dump: ${error}`);
            return ApiResponse.createMultiErrorResponse([`Failed to create dump: ${error}`]);
        }
    }
}
