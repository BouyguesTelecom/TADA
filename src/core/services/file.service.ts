import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { calculateSHA256 } from '../../utils/catalog';
import { logger } from '../../utils/logs/winston';
import { ICatalogResponse, ICatalogResponseMulti, ICatalogService } from '../interfaces/Icatalog';
import { IFile } from '../interfaces/Ifile';
import { IStorage } from '../interfaces/Istorage';
import { File } from '../models/file.model';
import { ApiResponse } from '../models/response.model';

export class FileService {
    private storage: IStorage;
    private catalogService: ICatalogService;

    constructor(storage: IStorage, catalogService: ICatalogService) {
        try {
            this.storage = storage;
            this.catalogService = catalogService;

            if (!this.catalogService) {
                logger.error('CatalogService is not provided in FileService constructor');
                throw new Error('CatalogService is required');
            }

            if (!this.storage) {
                logger.error('Storage is not provided in FileService constructor');
                throw new Error('Storage is required');
            }

            if (typeof this.catalogService.addFile !== 'function') {
                logger.error('catalogService.addFile is not a function');
                throw new Error('CatalogService missing required methods');
            }

            logger.info('FileService initialized successfully');
        } catch (error) {
            logger.error(`Error in FileService constructor: ${error}`);
            throw new Error(`Failed to initialize FileService: ${error}`);
        }
    }

    async uploadFile(
        fileBuffer: Buffer,
        metadata: Partial<IFile>,
        options: {
            namespace: string;
            stripMetadata?: boolean;
            convertToWebp?: boolean;
        }
    ): Promise<ICatalogResponse> {
        try {
            logger.info(`Uploading file: ${metadata.filename}`);

            if (!metadata.filename || !options.namespace) {
                return ApiResponse.createErrorResponse('Filename and namespace are required', 400);
            }

            const destination = metadata.destination || '';
            const fileExtension = metadata.filename.split('.').pop();
            const shouldConvertToWebp = options.convertToWebp && ['image/jpeg', 'image/png'].includes(metadata.mimetype || '');

            const finalExtension = shouldConvertToWebp ? 'webp' : fileExtension;
            const baseName = metadata.filename.split('.')[0];
            const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9\-@_%]+/g, '_');

            const uniqueName = `/${options.namespace}/${destination ? `${destination}/` : ''}${sanitizedBaseName}.${finalExtension}`;

            let processedBuffer = fileBuffer;
            if (shouldConvertToWebp) {
                processedBuffer = await this.convertToWebp(fileBuffer);
            }

            if (options.stripMetadata) {
                processedBuffer = await this.stripMetadata(processedBuffer, metadata.mimetype);
            }

            const signature = calculateSHA256(processedBuffer);
            const baseHost = process.env.NGINX_INGRESS || 'http://localhost:8080';
            const publicUrl = `${baseHost}/assets/media/full${uniqueName}`;

            const fileMetadata: Partial<IFile> = {
                ...metadata,
                uuid: metadata.uuid || uuidv4(),
                namespace: options.namespace,
                unique_name: uniqueName,
                signature,
                size: processedBuffer.length,
                mimetype: shouldConvertToWebp ? 'image/webp' : metadata.mimetype,
                original_mimetype: metadata.mimetype,
                version: metadata.version || 1,
                base_host: baseHost,
                public_url: publicUrl,
                destination: destination,
                toWebp: undefined
            };

            Object.keys(fileMetadata).forEach((key) => {
                if (fileMetadata[key] === undefined) {
                    delete fileMetadata[key];
                }
            });

            logger.info(`Sending file to storage with metadata: ${JSON.stringify(fileMetadata)}`);
            const storageResponse = await this.storage.uploadFile(processedBuffer, fileMetadata);

            if (!storageResponse.success || !storageResponse.file) {
                return {
                    status: 500,
                    datum: null,
                    error: storageResponse.error || 'Failed to upload file to storage'
                };
            }

            try {
                // Clean the file object before sending it to catalog
                const catalogFile = { ...storageResponse.file };
                delete catalogFile.toWebp;

                const catalogResponse = await this.catalogService.addFile(catalogFile);
                logger.info(`Catalog response: ${JSON.stringify(catalogResponse)}`);
                return catalogResponse;
            } catch (catalogError) {
                logger.error(`Error calling catalogService.addFile: ${catalogError}`);
                return {
                    status: 500,
                    datum: storageResponse.file,
                    error: `File uploaded to storage but failed to add to catalog: ${catalogError}`
                };
            }
        } catch (error) {
            logger.error(`Error in FileService.uploadFile: ${error}`);
            return {
                status: 500,
                datum: null,
                error: `Failed to upload file: ${error}`
            };
        }
    }

    async getFile(identifier: string): Promise<{ buffer: Buffer | null; metadata: IFile | null }> {
        try {
            const metadataResponse = await this.catalogService.getFile({ uuid: identifier });

            if (metadataResponse.status !== 200 || !metadataResponse.datum) {
                return {
                    buffer: null,
                    metadata: null
                };
            }

            const file = new File(metadataResponse.datum);
            if (file.isExpired()) {
                logger.info(`File ${identifier} is expired`);
                return {
                    buffer: null,
                    metadata: file
                };
            }

            const uniqueName = file.unique_name || identifier;
            const buffer = await this.storage.getFile(uniqueName);

            return {
                buffer,
                metadata: file
            };
        } catch (error) {
            logger.error(`Error in FileService.getFile: ${error}`);
            return {
                buffer: null,
                metadata: null
            };
        }
    }

    async updateFile(
        uuid: string,
        fileBuffer: Buffer | null,
        metadata: Partial<IFile>,
        options: {
            stripMetadata?: boolean;
            convertToWebp?: boolean;
        } = {}
    ): Promise<ICatalogResponse> {
        try {
            logger.info(`Updating file with UUID: ${uuid}`);

            const existingFileResponse = await this.catalogService.getFile({ uuid });

            if (existingFileResponse.status !== 200 || !existingFileResponse.datum) {
                return existingFileResponse;
            }

            const existingFile = existingFileResponse.datum;

            if (fileBuffer) {
                let processedBuffer = fileBuffer;

                const shouldConvertToWebp = options.convertToWebp && ['image/jpeg', 'image/png'].includes(metadata.mimetype || existingFile.mimetype || '');

                if (shouldConvertToWebp) {
                    processedBuffer = await this.convertToWebp(fileBuffer);
                }

                if (options.stripMetadata) {
                    processedBuffer = await this.stripMetadata(processedBuffer, metadata.mimetype || existingFile.mimetype);
                }

                const signature = calculateSHA256(processedBuffer);

                const updatedMetadata: Partial<IFile> = {
                    ...metadata,
                    signature,
                    size: processedBuffer.length,
                    mimetype: shouldConvertToWebp ? 'image/webp' : metadata.mimetype || existingFile.mimetype,
                    version: (existingFile.version || 0) + 1
                };

                const uniqueName = existingFile.unique_name || '';
                const storageResponse = await this.storage.uploadFile(processedBuffer, {
                    ...existingFile,
                    ...updatedMetadata
                });

                if (!storageResponse.success) {
                    return {
                        status: 500,
                        datum: null,
                        error: storageResponse.error || 'Failed to upload updated file'
                    };
                }
            }

            const updateData: Partial<IFile> = {
                ...metadata
            };

            if (fileBuffer) {
                updateData.version = (existingFile.version || 0) + 1;
            }

            return await this.catalogService.updateFile(uuid, updateData);
        } catch (error) {
            logger.error(`Error in FileService.updateFile: ${error}`);
            return {
                status: 500,
                datum: null,
                error: `Failed to update file: ${error}`
            };
        }
    }

    async deleteFile(uuid: string): Promise<ICatalogResponse> {
        try {
            logger.info(`Deleting file with UUID: ${uuid}`);

            const fileResponse = await this.catalogService.getFile({ uuid });

            if (fileResponse.status !== 200 || !fileResponse.datum) {
                return fileResponse;
            }

            const file = fileResponse.datum;
            const uniqueName = file.unique_name || '';

            const deleted = await this.storage.deleteFile(uniqueName);

            if (!deleted) {
                logger.warn(`Failed to delete file ${uniqueName} from storage`);
            }

            return await this.catalogService.deleteFile(uniqueName);
        } catch (error) {
            logger.error(`Error in FileService.deleteFile: ${error}`);
            return {
                status: 500,
                datum: null,
                error: `Failed to delete file: ${error}`
            };
        }
    }

    async uploadFiles(
        files: Array<{ buffer: Buffer; metadata: Partial<IFile> }>,
        options: {
            namespace: string;
            stripMetadata?: boolean;
            convertToWebp?: boolean;
        }
    ): Promise<ICatalogResponseMulti> {
        try {
            logger.info(`Uploading ${files.length} files`);

            const uploadedFiles: IFile[] = [];
            const errors: string[] = [];

            for (const file of files) {
                const result = await this.uploadFile(file.buffer, file.metadata, options);

                if (result.status === 200 && result.datum) {
                    uploadedFiles.push(result.datum);
                } else {
                    errors.push(result.error || 'Unknown error during file upload');
                }
            }

            if (errors.length === 0) {
                return {
                    status: 200,
                    data: uploadedFiles,
                    errors: null
                };
            } else if (uploadedFiles.length === 0) {
                return {
                    status: 400,
                    data: null,
                    errors
                };
            } else {
                return {
                    status: 207,
                    data: uploadedFiles,
                    errors
                };
            }
        } catch (error) {
            logger.error(`Error in FileService.uploadFiles: ${error}`);
            return {
                status: 500,
                data: null,
                errors: [`Failed to upload files: ${error}`]
            };
        }
    }

    private async convertToWebp(buffer: Buffer): Promise<Buffer> {
        try {
            return await sharp(buffer).webp({ quality: 90 }).toBuffer();
        } catch (error) {
            logger.error(`Error converting to WebP: ${error}`);
            return buffer;
        }
    }

    private async stripMetadata(buffer: Buffer, mimetype?: string): Promise<Buffer> {
        try {
            if (!mimetype) return buffer;

            if (mimetype.startsWith('image/')) {
                return await sharp(buffer).withMetadata({ exif: {} }).toBuffer();
            }

            return buffer;
        } catch (error) {
            logger.error(`Error stripping metadata: ${error}`);
            return buffer;
        }
    }

    private createErrorResponse(message: string, status: number = 500): ICatalogResponse {
        return ApiResponse.createErrorResponse(message, status);
    }
}
