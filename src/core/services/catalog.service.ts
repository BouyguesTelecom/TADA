import { PersistenceFactory } from '../../infrastructure/persistence/factory';
import { logger } from '../../utils/logs/winston';
import { ICatalogRepository, ICatalogResponse, ICatalogResponseMulti, ICatalogService } from '../interfaces/Icatalog';
import { IFile } from '../interfaces/Ifile';
import { Catalog } from '../models/catalog.model';
import { File } from '../models/file.model';
import { ApiResponse } from '../models/response.model';

export class CatalogService implements ICatalogService {
    private repository: ICatalogRepository;
    private catalog: Catalog;

    constructor(repository?: ICatalogRepository) {
        this.repository = repository || PersistenceFactory.createRepository();
        this.catalog = new Catalog();
    }

    private async refreshCatalog(): Promise<void> {
        try {
            logger.info('Refreshing catalog...');
            const files = await this.repository.findAll();
            logger.info(`Found ${files.length} files in repository`);
            this.catalog = new Catalog(files);
            logger.info('Catalog refreshed successfully');
        } catch (error) {
            logger.error(`Error refreshing catalog: ${error.message}`);
            throw error;
        }
    }

    async getFiles(): Promise<ICatalogResponseMulti> {
        try {
            logger.info('Getting all files from catalog...');
            await this.refreshCatalog();
            const files = this.catalog.getAllFiles();
            logger.info(`Successfully retrieved ${files.length} files from catalog`);
            return ApiResponse.successMulti(files);
        } catch (error) {
            logger.error(`Error getting files: ${error.message}`);
            return ApiResponse.errorMulti(`Failed to get files: ${error.message}`, []);
        }
    }

    async getFile(uuid: string): Promise<ICatalogResponse> {
        try {
            if (!uuid) {
                return ApiResponse.validationError('UUID is required');
            }

            const file = await this.repository.find(uuid);
            if (!file) {
                return ApiResponse.notFound(`File with UUID ${uuid} not found`);
            }

            return ApiResponse.successWithDatum(file);
        } catch (error) {
            logger.error(`Error getting file: ${error.message}`);
            return ApiResponse.errorWithDatum(error.message);
        }
    }

    async addFile(fileData: Partial<IFile>): Promise<ICatalogResponse> {
        try {
            if (!fileData.filename) {
                return ApiResponse.validationError('Filename is required');
            }

            const cleanedData = { ...fileData };
            delete cleanedData.toWebp;

            if (!cleanedData.public_url && cleanedData.unique_name) {
                const baseHost = cleanedData.base_host || process.env.NGINX_INGRESS || 'http://localhost:8080';
                cleanedData.public_url = `${baseHost}/assets/media/full${cleanedData.unique_name}`;
            }

            const file = await File.create(cleanedData);
            const savedFile = await this.repository.save(file);
            await this.refreshCatalog();

            return ApiResponse.successWithDatum(savedFile, 201);
        } catch (error) {
            logger.error(`Error adding file: ${error.message}`);
            return ApiResponse.errorWithDatum(error.message);
        }
    }

    async addFiles(filesData: IFile[]): Promise<ICatalogResponseMulti> {
        try {
            if (!filesData?.length) {
                return ApiResponse.errorMulti('No files provided for addition', []);
            }

            const files = await Promise.all(filesData.map((fileData) => File.from(fileData)));
            const result = await this.repository.addMany(files);

            if (result.status === 201 && result.data) {
                await this.refreshCatalog();
            }

            return result;
        } catch (error) {
            logger.error(`Error in CatalogService.addFiles: ${error}`);
            return ApiResponse.errorMulti(`Failed to add files: ${error}`, []);
        }
    }

    async updateFile(uuid: string, fileData: Partial<IFile>): Promise<ICatalogResponse> {
        try {
            if (!uuid) {
                return ApiResponse.validationError('UUID is required');
            }

            const existingFile = await this.repository.find(uuid);
            if (!existingFile) {
                return ApiResponse.notFound(`File with UUID ${uuid} not found`);
            }

            const updatedFile = await this.repository.save({ ...existingFile, ...fileData });
            await this.refreshCatalog();

            return ApiResponse.successWithDatum(updatedFile);
        } catch (error) {
            logger.error(`Error updating file: ${error.message}`);
            return ApiResponse.errorWithDatum(error.message);
        }
    }

    async deleteFile(uuid: string): Promise<ICatalogResponse> {
        try {
            if (!uuid) {
                return ApiResponse.validationError('UUID is required');
            }

            const file = await this.repository.find(uuid);
            if (!file) {
                return ApiResponse.notFound(`File with UUID ${uuid} not found`);
            }

            await this.repository.delete(uuid);
            await this.refreshCatalog();

            return ApiResponse.successWithDatum(file);
        } catch (error) {
            logger.error(`Error deleting file: ${error.message}`);
            return ApiResponse.errorWithDatum(error.message);
        }
    }

    async deleteAllFiles(): Promise<ICatalogResponseMulti> {
        try {
            const result = await this.repository.deleteAll();
            if (result.status === 200) {
                await this.refreshCatalog();
            }
            return result;
        } catch (error) {
            logger.error(`Error in CatalogService.deleteAllFiles: ${error}`);
            return ApiResponse.errorMulti(`Failed to delete files: ${error}`, []);
        }
    }

    async createDump(): Promise<{ status: number; data: string[]; errors: string[] }> {
        try {
            return await this.repository.createDump();
        } catch (error) {
            logger.error(`Error creating dump: ${error.message}`);
            return {
                status: 500,
                data: [],
                errors: [error.message]
            };
        }
    }
}

export const catalogService = new CatalogService();
