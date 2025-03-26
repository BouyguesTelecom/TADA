import { PersistenceFactory } from '../../infrastructure/persistence/factory';
import { logger } from '../../utils/logs/winston';
import { ICatalogRepository, ICatalogResponse, ICatalogResponseMulti, ICatalogService } from '../interfaces/Icatalog';
import { IFile } from '../interfaces/Ifile';
import { File } from '../models/file.model';

export class CatalogService implements ICatalogService {
    private repository: ICatalogRepository;

    constructor() {
        // If repository is not provided, create one using factory
        this.repository = PersistenceFactory.createRepository();
    }

    async getFiles(): Promise<ICatalogResponseMulti> {
        try {
            logger.info('Getting all files from catalog');
            return await this.repository.getAll();
        } catch (error) {
            logger.error(`Error in CatalogService.getFiles: ${error}`);
            return {
                status: 500,
                data: [],
                errors: [`Failed to get files: ${error}`]
            };
        }
    }

    async getFile({ uuid }: { uuid: string }): Promise<ICatalogResponse> {
        try {
            logger.info(`Getting file with UUID: ${uuid}`);
            return await this.repository.getByUuid(uuid);
        } catch (error) {
            logger.error(`Error in CatalogService.getFile: ${error}`);
            return {
                status: 500,
                datum: null,
                error: `Failed to get file: ${error}`
            };
        }
    }

    async addFile(fileData: IFile): Promise<ICatalogResponse> {
        try {
            logger.info('Adding file to catalog');

            if (!fileData.filename) {
                return {
                    status: 400,
                    datum: null,
                    error: 'Filename is required'
                };
            }

            const file = new File(fileData);

            return await this.repository.add(file);
        } catch (error) {
            logger.error(`Error in CatalogService.addFile: ${error}`);
            return {
                status: 500,
                datum: null,
                error: `Failed to add file: ${error}`
            };
        }
    }

    async addFiles(filesData: IFile[]): Promise<ICatalogResponseMulti> {
        try {
            logger.info('Adding multiple files to catalog');

            if (!filesData || !filesData.length) {
                return {
                    status: 400,
                    data: null,
                    errors: ['No files provided for addition']
                };
            }

            const files = filesData.map((fileData) => new File(fileData));

            return await this.repository.addMany(files);
        } catch (error) {
            logger.error(`Error in CatalogService.addFiles: ${error}`);
            return {
                status: 500,
                data: null,
                errors: [`Failed to add files: ${error}`]
            };
        }
    }

    async updateFile(uuid: string, fileData: Partial<IFile>): Promise<ICatalogResponse> {
        try {
            logger.info(`Updating file with UUID: ${uuid}`);

            if (!uuid) {
                return {
                    status: 400,
                    datum: null,
                    error: 'UUID is required'
                };
            }

            return await this.repository.update(uuid, fileData);
        } catch (error) {
            logger.error(`Error in CatalogService.updateFile: ${error}`);
            return {
                status: 500,
                datum: null,
                error: `Failed to update file: ${error}`
            };
        }
    }

    async deleteFile(uniqueName: string): Promise<ICatalogResponse> {
        try {
            logger.info(`Deleting file with unique name: ${uniqueName}`);

            if (!uniqueName) {
                return {
                    status: 400,
                    datum: null,
                    error: 'Unique name is required'
                };
            }

            const catalog = await this.getFiles();

            if (catalog.status !== 200 || !catalog.data) {
                return {
                    status: 500,
                    datum: null,
                    error: 'Failed to access catalog'
                };
            }

            const file = catalog.data.find((item) => item.unique_name === uniqueName);

            if (!file || !file.uuid) {
                return {
                    status: 404,
                    datum: null,
                    error: 'File not found'
                };
            }

            return await this.repository.delete(file.uuid);
        } catch (error) {
            logger.error(`Error in CatalogService.deleteFile: ${error}`);
            return {
                status: 500,
                datum: null,
                error: `Failed to delete file: ${error}`
            };
        }
    }

    async deleteAllFiles(): Promise<ICatalogResponseMulti> {
        try {
            logger.info('Deleting all files from catalog');
            return await this.repository.deleteAll();
        } catch (error) {
            logger.error(`Error in CatalogService.deleteAllFiles: ${error}`);
            return {
                status: 500,
                data: null,
                errors: [`Failed to delete files: ${error}`]
            };
        }
    }

    async createDump(): Promise<{ status: number; data: string[]; errors: string[] }> {
        try {
            logger.info('Creating catalog dump');
            const result = await this.repository.createDump();

            return {
                status: result.status,
                data: ['Succesfully created dump !'],
                errors: []
            };
        } catch (error) {
            logger.error(`Error in CatalogService.createDump: ${error}`);
            return {
                status: 500,
                data: [],
                errors: [`Failed to create dump: ${error}`]
            };
        }
    }
}

const catalogService = new CatalogService();

export default catalogService;
