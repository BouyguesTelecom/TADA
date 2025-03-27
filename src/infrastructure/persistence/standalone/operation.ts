import fs from 'fs';
import path from 'path';
import { ICatalogResponse, ICatalogResponseMulti } from '../../../core/interfaces/Icatalog';
import { IFile } from '../../../core/interfaces/Ifile';
import { File } from '../../../core/models/file.model';
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
            // Ensure the directory exists
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
            const fileInstances = files.map((file) => new File(file));

            return ApiResponse.createMultiSuccessResponse(fileInstances);
        } catch (error) {
            logger.error(`Error getting all files: ${error}`);
            return ApiResponse.createMultiErrorResponse([`Failed to get catalog: ${error}`]);
        }
    }

    public static getOneFile(uuid: string): ICatalogResponse {
        try {
            if (!uuid || typeof uuid !== 'string') {
                return ApiResponse.createErrorResponse('Invalid UUID format', 400);
            }

            const files = this.readCatalog();
            const file = files.find((f) => f.uuid === uuid);

            if (!file) {
                return ApiResponse.createErrorResponse(`File with UUID ${uuid} not found`, 404);
            }

            return ApiResponse.createSuccessResponse(new File(file));
        } catch (error) {
            logger.error(`Error getting file by UUID: ${error}`);
            return ApiResponse.createErrorResponse(`Failed to get file: ${error}`, 500);
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
                return ApiResponse.createErrorResponse(`File with UUID ${file.uuid} already exists`, 409);
            }

            if (file.unique_name && this.isUniqueNameExists(file.unique_name)) {
                return ApiResponse.createErrorResponse(`File with unique_name ${file.unique_name} already exists`, 409);
            }

            const fileInstance = new File(file);
            files.push(fileInstance);

            const success = this.writeCatalog(files);
            if (!success) {
                return ApiResponse.createErrorResponse('Failed to write to catalog file', 500);
            }

            return ApiResponse.createSuccessResponse(fileInstance, 201);
        } catch (error) {
            logger.error(`Error adding file: ${error}`);
            return ApiResponse.createErrorResponse(`Failed to add file: ${error}`, 500);
        }
    }

    public static addMultipleFiles(files: IFile[]): ICatalogResponseMulti {
        try {
            if (!Array.isArray(files)) {
                return ApiResponse.createMultiErrorResponse(['Input must be an array of files'], 400);
            }

            if (files.length === 0) {
                return ApiResponse.createMultiErrorResponse(['No files provided for addition'], 400);
            }

            const validationErrors = validateFiles(files);
            if (validationErrors) {
                const errorMessages = validationErrors.map((error) => `${error.path.join('.')}: ${error.message}`);

                return ApiResponse.createMultiErrorResponse(errorMessages, 400);
            }

            const existingFiles = this.readCatalog();
            const fileInstances = files.map((file) => new File(file));
            const updatedFiles = [...existingFiles, ...fileInstances];

            const success = this.writeCatalog(updatedFiles);
            if (!success) {
                return ApiResponse.createMultiErrorResponse(['Failed to write to catalog file'], 500);
            }

            return ApiResponse.createMultiSuccessResponse(fileInstances, 201);
        } catch (error) {
            logger.error(`Error adding multiple files: ${error}`);
            return ApiResponse.createMultiErrorResponse([`Failed to add files: ${error}`], 500);
        }
    }

    public static updateOneFile(uuid: string, fileData: Partial<IFile>): ICatalogResponse {
        try {
            if (!uuid || typeof uuid !== 'string') {
                return ApiResponse.createErrorResponse('Invalid UUID format', 400);
            }

            const files = this.readCatalog();
            const fileIndex = files.findIndex((f) => f.uuid === uuid);

            if (fileIndex === -1) {
                return ApiResponse.createErrorResponse(`File with UUID ${uuid} not found`, 404);
            }

            const updatedFile = { ...files[fileIndex], ...fileData };
            files[fileIndex] = updatedFile;

            const success = this.writeCatalog(files);
            if (!success) {
                return ApiResponse.createErrorResponse('Failed to write to catalog file', 500);
            }

            return ApiResponse.createSuccessResponse(new File(updatedFile));
        } catch (error) {
            logger.error(`Error updating file: ${error}`);
            return ApiResponse.createErrorResponse(`Failed to update file: ${error}`, 500);
        }
    }

    public static deleteOneFile(uuid: string): ICatalogResponse {
        try {
            if (!uuid || typeof uuid !== 'string') {
                return ApiResponse.createErrorResponse('Invalid UUID format', 400);
            }

            const files = this.readCatalog();

            const fileToDelete = files.find((f) => f.uuid === uuid);
            if (!fileToDelete) {
                return ApiResponse.createErrorResponse(`File with UUID ${uuid} not found`, 404);
            }

            const updatedFiles = files.filter((f) => f.uuid !== uuid);
            const success = this.writeCatalog(updatedFiles);

            if (!success) {
                return ApiResponse.createErrorResponse('Failed to write to catalog file', 500);
            }

            return ApiResponse.createSuccessResponse(fileToDelete);
        } catch (error) {
            logger.error(`Error deleting file: ${error}`);
            return ApiResponse.createErrorResponse(`Failed to delete file: ${error}`, 500);
        }
    }

    public static deleteAllFiles(): ICatalogResponseMulti {
        try {
            const success = this.writeCatalog([]);

            if (!success) {
                return ApiResponse.createMultiErrorResponse(['Failed to clear catalog file'], 500);
            }

            return ApiResponse.createMultiSuccessResponse([]);
        } catch (error) {
            logger.error(`Error deleting all files: ${error}`);
            return ApiResponse.createMultiErrorResponse([`Failed to delete all files: ${error}`], 500);
        }
    }

    public static createCatalogDump(version: string): ICatalogResponseMulti {
        try {
            const backupPath = path.join('/tmp/standalone', `catalog-backup-${version}.json`);

            fs.copyFileSync(this.catalogPath, backupPath);

            return ApiResponse.createMultiSuccessResponse([], 200, `Dump created successfully at ${backupPath}`);
        } catch (error) {
            logger.error(`Error creating dump: ${error}`);
            return ApiResponse.createMultiErrorResponse([`Failed to create dump: ${error}`], 500);
        }
    }
}
