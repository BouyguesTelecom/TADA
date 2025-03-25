import fs from 'fs';
import path from 'path';
import catalogService from '../../../core/services/catalog.service';
import { logger } from '../../../utils/logs/winston';
import { BaseStorage, StorageFileProps, StorageFilesProps, StorageResponse } from '../baseStorage';

export class StandaloneStorage extends BaseStorage {
    private basePath: string;

    constructor() {
        super('STANDALONE');
        this.basePath = '/tmp/standalone';
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

    async getLastDump(): Promise<StorageResponse> {
        try {
            const catalogDir = path.join(this.basePath, 'catalog');
            if (!fs.existsSync(catalogDir)) {
                return this.createErrorResponse(404, 'Catalog directory not found');
            }

            const files = fs
                .readdirSync(catalogDir)
                .filter((file) => file.endsWith('.json'))
                .map((file) => ({ name: file, path: path.join(catalogDir, file) }));

            if (files.length === 0) {
                return this.createErrorResponse(404, 'No dump files found');
            }

            files.sort((a, b) => {
                return fs.statSync(b.path).mtime.getTime() - fs.statSync(a.path).mtime.getTime();
            });

            const latestDump = files[0];
            const data = await fs.promises.readFile(latestDump.path, 'utf-8');
            const parsedData = JSON.parse(data);

            if (Array.isArray(parsedData) && parsedData.length > 0) {
                await catalogService.addFiles(parsedData);
            }

            return this.createSuccessResponse(parsedData, `Loaded dump from ${latestDump.name}`);
        } catch (error) {
            return this.createErrorResponse(500, `Failed to get last dump: ${error}`);
        }
    }

    async getFile(props: StorageFileProps): Promise<StorageResponse> {
        const { filepath } = props;
        const fullPath = path.join(this.basePath, filepath);
        try {
            if (!fs.existsSync(fullPath)) {
                return this.createNotFoundResponse(filepath);
            }

            const fileStream = fs.createReadStream(fullPath);
            return this.createSuccessResponse(fileStream);
        } catch (error) {
            return this.createErrorResponse(500, `Failed to get file ${filepath}: ${error}`);
        }
    }

    async upload(props: StorageFileProps): Promise<StorageResponse> {
        const { filepath, file } = props;
        try {
            if (!file) {
                return this.createErrorResponse(400, 'No file content provided');
            }

            if (!this.createDirectoryForFile(filepath)) {
                return this.createErrorResponse(500, `Failed to create directory for ${filepath}`);
            }

            const success = await this.writeFile(filepath, file);
            if (!success) {
                return this.createErrorResponse(500, `Failed to write file ${filepath}`);
            }

            return this.createSuccessResponse(null, `File ${filepath} uploaded successfully`);
        } catch (error) {
            return this.createErrorResponse(500, `Upload failed: ${error}`);
        }
    }

    async uploads(props: StorageFilesProps): Promise<StorageResponse> {
        const { filespath, files } = props;

        try {
            if (!Array.isArray(filespath) || !Array.isArray(files) || filespath.length !== files.length) {
                return this.createErrorResponse(400, 'Invalid files or paths provided');
            }

            const results: string[] = [];
            const errors: string[] = [];

            for (let i = 0; i < filespath.length; i++) {
                const filepath = filespath[i];
                const file = files[i];

                if (!this.createDirectoryForFile(filepath)) {
                    errors.push(filepath);
                    continue;
                }

                const success = await this.writeFile(filepath, file);
                if (success) {
                    results.push(filepath);
                } else {
                    errors.push(filepath);
                }
            }

            return {
                status: 200,
                message: `Uploaded ${results.length} files, failed ${errors.length} files`,
                results: { success: results, errors }
            };
        } catch (error) {
            return this.createErrorResponse(500, `Upload failed: ${error}`);
        }
    }

    async update(props: StorageFileProps): Promise<StorageResponse> {
        return this.upload(props);
    }

    async updates(props: StorageFilesProps): Promise<StorageResponse> {
        return this.uploads(props);
    }

    async delete(props: StorageFileProps): Promise<StorageResponse> {
        const { filepath } = props;
        const fullPath = path.join(this.basePath, filepath);
        try {
            if (!fs.existsSync(fullPath)) {
                return this.createNotFoundResponse(filepath);
            }

            await fs.promises.unlink(fullPath);
            return this.createSuccessResponse(null, `File ${filepath} deleted successfully`);
        } catch (error) {
            return this.createErrorResponse(500, `Failed to delete file ${filepath}: ${error}`);
        }
    }

    async deleteFiles(props: StorageFilesProps): Promise<StorageResponse> {
        const { filespath } = props;
        try {
            if (!Array.isArray(filespath)) {
                return this.createErrorResponse(400, 'No file paths provided or invalid format');
            }

            const results: string[] = [];
            const errors: string[] = [];

            for (const filepath of filespath) {
                const fullPath = path.join(this.basePath, filepath);

                if (!fs.existsSync(fullPath)) {
                    errors.push(filepath);
                    continue;
                }

                try {
                    await fs.promises.unlink(fullPath);
                    results.push(filepath);
                } catch (error) {
                    errors.push(filepath);
                }
            }

            return {
                status: 200,
                message: `Deleted ${results.length} files, failed ${errors.length} files`,
                results: { success: results, errors }
            };
        } catch (error) {
            return this.createErrorResponse(500, `Delete operation failed: ${error}`);
        }
    }
}
