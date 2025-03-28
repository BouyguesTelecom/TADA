import fs from 'fs';
import path from 'path';
import { IFile } from '../../../core/interfaces/Ifile';
import { IStorageResponse } from '../../../core/interfaces/Istorage';
import { CatalogService } from '../../../core/services/catalog.service';
import { logger } from '../../../utils/logs/winston';
import { BaseStorage, StorageFileProps } from '../baseStorage';

export class StandaloneStorage extends BaseStorage {
    private basePath: string;
    private catalogService: CatalogService;

    constructor() {
        super('STANDALONE');
        this.basePath = '/tmp/standalone';
        this.catalogService = new CatalogService();
        this.ensureBaseDirectoryExists();
    }

    private ensureBaseDirectoryExists(): void {
        try {
            if (!fs.existsSync(this.basePath)) {
                logger.info(`Creating base directory: ${this.basePath}`);
                fs.mkdirSync(this.basePath, { recursive: true });
            }
        } catch (error) {
            logger.error(`Failed to create base directory ${this.basePath}: ${error}`);
            throw new Error(`Failed to initialize storage: ${error}`);
        }
    }

    private createDirectoryForFile(filepath: string): boolean {
        try {
            const dirPath = path.dirname(path.join(this.basePath, filepath));
            if (!fs.existsSync(dirPath)) {
                logger.info(`Creating directory: ${dirPath}`);
                fs.mkdirSync(dirPath, { recursive: true });
            }
            return true;
        } catch (error) {
            logger.error(`Failed to create directory for ${filepath}: ${error}`);
            return false;
        }
    }

    private async writeFile(filepath: string, data: Buffer | string): Promise<boolean> {
        const fullPath = path.join(this.basePath, filepath);
        try {
            await fs.promises.writeFile(fullPath, data);
            logger.info(`File saved successfully at ${fullPath}`);
            return true;
        } catch (error) {
            logger.error(`Failed to write file at ${fullPath}: ${error}`);
            return false;
        }
    }

    protected async getLastDumpFromStorage(): Promise<IStorageResponse> {
        try {
            const catalogDir = path.join(this.basePath, 'catalog');
            if (!fs.existsSync(catalogDir)) {
                return this.createErrorResponse('Catalog directory not found');
            }

            const files = fs
                .readdirSync(catalogDir)
                .filter((file) => file.endsWith('.json'))
                .map((file) => ({ name: file, path: path.join(catalogDir, file) }));

            if (files.length === 0) {
                return this.createErrorResponse('No dump files found');
            }

            files.sort((a, b) => {
                return fs.statSync(b.path).mtime.getTime() - fs.statSync(a.path).mtime.getTime();
            });

            const latestDump = files[0];
            const data = await fs.promises.readFile(latestDump.path, 'utf-8');
            const parsedData = JSON.parse(data);

            if (Array.isArray(parsedData) && parsedData.length > 0) {
                await this.catalogService.addFiles(parsedData);
            }

            return this.createSuccessResponse(parsedData, `Loaded dump from ${latestDump.name}`);
        } catch (error) {
            return this.createErrorResponse(`Failed to get last dump: ${error}`);
        }
    }

    protected async getFileFromStorage(props: StorageFileProps): Promise<IStorageResponse> {
        const { filepath } = props;
        const fullPath = path.join(this.basePath, filepath);
        try {
            if (!fs.existsSync(fullPath)) {
                return this.createNotFoundResponse(filepath);
            }

            const data = await fs.promises.readFile(fullPath);
            return this.createSuccessResponse(data);
        } catch (error) {
            return this.createErrorResponse(`Failed to get file ${filepath}: ${error}`);
        }
    }

    protected async upload(props: StorageFileProps): Promise<IStorageResponse> {
        const { filepath, file } = props;
        try {
            if (!file) {
                return this.createErrorResponse('No file content provided');
            }

            if (!this.createDirectoryForFile(filepath)) {
                return this.createErrorResponse(`Failed to create directory for ${filepath}`);
            }

            const success = await this.writeFile(filepath, file);
            if (!success) {
                return this.createErrorResponse(`Failed to write file ${filepath}`);
            }

            return this.createSuccessResponse(null, `File ${filepath} uploaded successfully`);
        } catch (error) {
            return this.createErrorResponse(`Upload failed: ${error}`);
        }
    }

    protected async deleteFromStorage(props: StorageFileProps): Promise<IStorageResponse> {
        const { filepath } = props;
        const fullPath = path.join(this.basePath, filepath);
        try {
            if (!fs.existsSync(fullPath)) {
                return this.createNotFoundResponse(filepath);
            }

            await fs.promises.unlink(fullPath);
            return this.createSuccessResponse(null, `File ${filepath} deleted successfully`);
        } catch (error) {
            return this.createErrorResponse(`Failed to delete file ${filepath}: ${error}`);
        }
    }

    async uploads(files: Array<{ filepath: string; file?: Buffer; metadata?: Partial<IFile> }>): Promise<IStorageResponse> {
        try {
            if (!Array.isArray(files) || !files.length) {
                return this.createErrorResponse('Invalid files provided');
            }

            const results: string[] = [];
            const errors: string[] = [];

            for (const file of files) {
                if (!file.file) {
                    errors.push(file.filepath);
                    continue;
                }

                if (!this.createDirectoryForFile(file.filepath)) {
                    errors.push(file.filepath);
                    continue;
                }

                const success = await this.writeFile(file.filepath, file.file);
                if (success) {
                    results.push(file.filepath);
                } else {
                    errors.push(file.filepath);
                }
            }

            return this.createSuccessResponse({ success: results, errors }, `Uploaded ${results.length} files, failed ${errors.length} files`);
        } catch (error) {
            return this.createErrorResponse(`Upload failed: ${error}`);
        }
    }

    async deleteFiles(files: Array<{ filepath: string }>): Promise<IStorageResponse> {
        try {
            if (!Array.isArray(files) || !files.length) {
                return this.createErrorResponse('Invalid files provided');
            }

            const results: string[] = [];
            const errors: string[] = [];

            for (const file of files) {
                const fullPath = path.join(this.basePath, file.filepath);

                if (!fs.existsSync(fullPath)) {
                    errors.push(file.filepath);
                    continue;
                }

                try {
                    await fs.promises.unlink(fullPath);
                    results.push(file.filepath);
                } catch (error) {
                    errors.push(file.filepath);
                }
            }

            return this.createSuccessResponse({ success: results, errors }, `Deleted ${results.length} files, failed ${errors.length} files`);
        } catch (error) {
            return this.createErrorResponse(`Delete operation failed: ${error}`);
        }
    }
}
