import fs from 'fs';
import path from 'path';
import { ICatalogResponse, ICatalogResponseMulti } from '../../../core/interfaces/Icatalog';
import { IFile } from '../../../core/interfaces/Ifile';
import { ApiResponse } from '../../../core/models/response.model';
import { logger } from '../../../utils/logs/winston';
import { validateFiles } from '../validators/file.validator';

export class StandaloneOperations {
    private static catalogPath = '/tmp/standalone/catalog.json';

    public static readCatalog(): IFile[] {
        try {
            if (!fs.existsSync(this.catalogPath)) {
                logger.warning('Catalog file does not exist, returning empty array');
                return [];
            }

            const data = fs.readFileSync(this.catalogPath, 'utf8');
            const catalog = JSON.parse(data);
            return catalog.data || [];
        } catch (error) {
            logger.error(`Error reading catalog from disk: ${error}`);
            return [];
        }
    }

    public static writeCatalog(files: IFile[]): boolean {
        try {
            const dir = path.dirname(this.catalogPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(this.catalogPath, JSON.stringify({ data: files }));
            return true;
        } catch (error) {
            logger.error(`Error writing catalog to disk: ${error}`);
            return false;
        }
    }

    public static getAllFiles(): ICatalogResponseMulti {
        try {
            const files = this.readCatalog();
            return ApiResponse.successMulti(files);
        } catch (error) {
            logger.error(`Error getting all files: ${error}`);
            return ApiResponse.errorMulti(`Failed to get catalog: ${error}`, []);
        }
    }

    public static getOneFile(uuid: string): ICatalogResponse {
        try {
            if (!uuid || typeof uuid !== 'string') {
                return ApiResponse.validationError('Invalid UUID format');
            }

            const files = this.readCatalog();
            const file = files.find((f) => f.uuid === uuid);

            if (!file) {
                return ApiResponse.notFound(`File with UUID ${uuid} not found`);
            }

            return ApiResponse.successWithDatum(file);
        } catch (error) {
            logger.error(`Error getting file by UUID: ${error}`);
            return ApiResponse.errorWithDatum(`Failed to get file: ${error}`);
        }
    }

    public static isUniqueNameExists(uniqueName: string): boolean {
        const files = this.readCatalog();
        return files.some((file) => file.unique_name === uniqueName);
    }

    public static isUuidExists(uuid: string): boolean {
        const files = this.readCatalog();
        return files.some((file) => file.uuid === uuid);
    }

    public static addOneFile(file: IFile): ICatalogResponse {
        try {
            const files = this.readCatalog();

            if (file.uuid && this.isUuidExists(file.uuid)) {
                return ApiResponse.errorWithDatum(`File with UUID ${file.uuid} already exists`, 409);
            }

            if (file.unique_name && this.isUniqueNameExists(file.unique_name)) {
                return ApiResponse.errorWithDatum(`File with unique_name ${file.unique_name} already exists`, 409);
            }

            files.push(file);

            const success = this.writeCatalog(files);
            if (!success) {
                return ApiResponse.errorWithDatum('Failed to write to catalog file');
            }

            return ApiResponse.successWithDatum(file, 201);
        } catch (error) {
            logger.error(`Error adding file: ${error}`);
            return ApiResponse.errorWithDatum(`Failed to add file: ${error}`);
        }
    }

    public static addMultipleFiles(files: IFile[]): ICatalogResponseMulti {
        try {
            if (!Array.isArray(files)) {
                return ApiResponse.errorMulti('Input must be an array of files', []);
            }

            if (files.length === 0) {
                return ApiResponse.errorMulti('No files provided for addition', []);
            }

            const validationErrors = validateFiles(files);
            if (validationErrors) {
                const errorMessages = validationErrors.map((error) => `${error.path.join('.')}: ${error.message}`);
                return ApiResponse.errorMulti('Files validation failed', errorMessages);
            }

            const existingFiles = this.readCatalog();
            const updatedFiles = [...existingFiles, ...files];

            const success = this.writeCatalog(updatedFiles);
            if (!success) {
                return ApiResponse.errorMulti('Failed to write to catalog file', []);
            }

            return ApiResponse.successMulti(files);
        } catch (error) {
            logger.error(`Error adding multiple files: ${error}`);
            return ApiResponse.errorMulti(`Failed to add files: ${error}`, []);
        }
    }

    public static updateOneFile(uuid: string, fileData: Partial<IFile>): ICatalogResponse {
        try {
            if (!uuid || typeof uuid !== 'string') {
                return ApiResponse.validationError('Invalid UUID format');
            }

            const files = this.readCatalog();
            const fileIndex = files.findIndex((f) => f.uuid === uuid);

            if (fileIndex === -1) {
                return ApiResponse.notFound(`File with UUID ${uuid} not found`);
            }

            const updatedFile = { ...files[fileIndex], ...fileData };
            files[fileIndex] = updatedFile;

            const success = this.writeCatalog(files);
            if (!success) {
                return ApiResponse.errorWithDatum('Failed to write to catalog file');
            }

            return ApiResponse.successWithDatum(updatedFile);
        } catch (error) {
            logger.error(`Error updating file: ${error}`);
            return ApiResponse.errorWithDatum(`Failed to update file: ${error}`);
        }
    }

    public static deleteOneFile(uuid: string): ICatalogResponse {
        try {
            if (!uuid || typeof uuid !== 'string') {
                return ApiResponse.validationError('Invalid UUID format');
            }

            const files = this.readCatalog();
            const fileToDelete = files.find((f) => f.uuid === uuid);

            if (!fileToDelete) {
                return ApiResponse.notFound(`File with UUID ${uuid} not found`);
            }

            const updatedFiles = files.filter((f) => f.uuid !== uuid);
            const success = this.writeCatalog(updatedFiles);

            if (!success) {
                return ApiResponse.errorWithDatum('Failed to write to catalog file');
            }

            return ApiResponse.successWithDatum(fileToDelete);
        } catch (error) {
            logger.error(`Error deleting file: ${error}`);
            return ApiResponse.errorWithDatum(`Failed to delete file: ${error}`);
        }
    }

    public static deleteAllFiles(): ICatalogResponseMulti {
        try {
            const success = this.writeCatalog([]);

            if (!success) {
                return ApiResponse.errorMulti('Failed to clear catalog file', []);
            }

            return ApiResponse.successMulti([]);
        } catch (error) {
            logger.error(`Error deleting all files: ${error}`);
            return ApiResponse.errorMulti(`Failed to delete all files: ${error}`, []);
        }
    }

    public static createCatalogDump(version: string): ICatalogResponseMulti {
        try {
            const backupPath = path.join('/tmp/standalone', `catalog-backup-${version}.json`);
            fs.copyFileSync(this.catalogPath, backupPath);

            return ApiResponse.successMulti([]);
        } catch (error) {
            logger.error(`Error creating dump: ${error}`);
            return ApiResponse.errorMulti(`Failed to create dump: ${error}`, []);
        }
    }
}
