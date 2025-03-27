import fs from 'fs';
import path from 'path';
import { ICatalogResponse, ICatalogResponseMulti } from '../../../core/interfaces/Icatalog';
import { IFile } from '../../../core/interfaces/Ifile';
import { File } from '../../../core/models/file.model';
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

            return {
                status: 200,
                data: fileInstances,
                errors: null
            };
        } catch (error) {
            logger.error(`Error getting all files: ${error}`);
            return {
                status: 500,
                data: null,
                errors: [`Failed to get catalog: ${error}`]
            };
        }
    }

    public static getOneFile(uuid: string): ICatalogResponse {
        try {
            if (!uuid || typeof uuid !== 'string') {
                return {
                    status: 400,
                    datum: null,
                    error: 'Invalid UUID format'
                };
            }

            const files = this.readCatalog();
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
                datum: new File(file),
                error: null
            };
        } catch (error) {
            logger.error(`Error getting file by UUID: ${error}`);
            return {
                status: 500,
                datum: null,
                error: `Failed to get file: ${error}`
            };
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
                return {
                    status: 409,
                    datum: null,
                    error: `File with UUID ${file.uuid} already exists`
                };
            }

            if (file.unique_name && this.isUniqueNameExists(file.unique_name)) {
                return {
                    status: 409,
                    datum: null,
                    error: `File with unique_name ${file.unique_name} already exists`
                };
            }

            const fileInstance = new File(file);
            files.push(fileInstance);

            const success = this.writeCatalog(files);
            if (!success) {
                return {
                    status: 500,
                    datum: null,
                    error: 'Failed to write to catalog file'
                };
            }

            return {
                status: 201,
                datum: fileInstance,
                error: null
            };
        } catch (error) {
            logger.error(`Error adding file: ${error}`);
            return {
                status: 500,
                datum: null,
                error: `Failed to add file: ${error}`
            };
        }
    }

    public static addMultipleFiles(files: IFile[]): ICatalogResponseMulti {
        try {
            if (!Array.isArray(files)) {
                return {
                    status: 400,
                    data: null,
                    errors: ['Input must be an array of files']
                };
            }

            if (files.length === 0) {
                return {
                    status: 400,
                    data: null,
                    errors: ['No files provided for addition']
                };
            }

            const validationErrors = validateFiles(files);
            if (validationErrors) {
                const errorMessages = validationErrors.map((error) => `${error.path.join('.')}: ${error.message}`);

                return {
                    status: 400,
                    data: null,
                    errors: errorMessages
                };
            }

            const existingFiles = this.readCatalog();
            const fileInstances = files.map((file) => new File(file));
            const updatedFiles = [...existingFiles, ...fileInstances];

            const success = this.writeCatalog(updatedFiles);
            if (!success) {
                return {
                    status: 500,
                    data: null,
                    errors: ['Failed to write to catalog file']
                };
            }

            return {
                status: 201,
                data: fileInstances,
                errors: null
            };
        } catch (error) {
            logger.error(`Error adding multiple files: ${error}`);
            return {
                status: 500,
                data: null,
                errors: [`Failed to add files: ${error}`]
            };
        }
    }

    public static updateOneFile(uuid: string, fileData: Partial<IFile>): ICatalogResponse {
        try {
            if (!uuid || typeof uuid !== 'string') {
                return {
                    status: 400,
                    datum: null,
                    error: 'Invalid UUID format'
                };
            }

            const files = this.readCatalog();
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

            const success = this.writeCatalog(files);
            if (!success) {
                return {
                    status: 500,
                    datum: null,
                    error: 'Failed to write to catalog file'
                };
            }

            return {
                status: 200,
                datum: new File(updatedFile),
                error: null
            };
        } catch (error) {
            logger.error(`Error updating file: ${error}`);
            return {
                status: 500,
                datum: null,
                error: `Failed to update file: ${error}`
            };
        }
    }

    public static deleteOneFile(uuid: string): ICatalogResponse {
        try {
            if (!uuid || typeof uuid !== 'string') {
                return {
                    status: 400,
                    datum: null,
                    error: 'Invalid UUID format'
                };
            }

            const files = this.readCatalog();

            const fileToDelete = files.find((f) => f.uuid === uuid);
            if (!fileToDelete) {
                return {
                    status: 404,
                    datum: null,
                    error: `File with UUID ${uuid} not found`
                };
            }

            const updatedFiles = files.filter((f) => f.uuid !== uuid);
            const success = this.writeCatalog(updatedFiles);

            if (!success) {
                return {
                    status: 500,
                    datum: null,
                    error: 'Failed to write to catalog file'
                };
            }

            return {
                status: 200,
                datum: fileToDelete,
                error: null
            };
        } catch (error) {
            logger.error(`Error deleting file: ${error}`);
            return {
                status: 500,
                datum: null,
                error: `Failed to delete file: ${error}`
            };
        }
    }

    public static deleteAllFiles(): ICatalogResponseMulti {
        try {
            const success = this.writeCatalog([]);

            if (!success) {
                return {
                    status: 500,
                    data: null,
                    errors: ['Failed to clear catalog file']
                };
            }

            return {
                status: 200,
                data: [],
                errors: null
            };
        } catch (error) {
            logger.error(`Error deleting all files: ${error}`);
            return {
                status: 500,
                data: null,
                errors: [`Failed to delete all files: ${error}`]
            };
        }
    }

    public static createCatalogDump(version: string): ICatalogResponseMulti {
        try {
            const backupPath = path.join('/tmp/standalone', `catalog-backup-${version}.json`);

            fs.copyFileSync(this.catalogPath, backupPath);

            return {
                status: 200,
                data: [],
                errors: [`Dump created successfully at ${backupPath}`]
            };
        } catch (error) {
            logger.error(`Error creating dump: ${error}`);
            return {
                status: 500,
                data: null,
                errors: [`Failed to create dump: ${error}`]
            };
        }
    }
}
