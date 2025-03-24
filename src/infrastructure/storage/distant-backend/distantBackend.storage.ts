import FormData from 'form-data';
import fetch, { Headers } from 'node-fetch';
import { CatalogService } from '../../../core/services/catalog.service';
import { logger } from '../../../utils/logs/winston';
import { BaseStorage, StorageFileProps, StorageFilesProps, StorageResponse } from '../baseStorage';

export class DistantBackendStorage extends BaseStorage {
    private baseUrl: string;
    private catalogService: CatalogService;
    private token: string;
    private singlePath: string;
    private multiPath: string;

    constructor() {
        super('DISTANT_BACKEND');
        this.baseUrl = process.env.DELEGATED_STORAGE_HOST || 'http://localhost:3000';
        this.token = process.env.DELEGATED_STORAGE_TOKEN || '';
        this.singlePath = process.env.DELEGATED_STORAGE_SINGLE_PATH || '';
        this.multiPath = process.env.DELEGATED_STORAGE_MULTI_PATH || '';
        this.catalogService = new CatalogService();
        logger.info(`DistantBackendStorage initialized with host: ${this.baseUrl}`);
    }

    private generateUrl(filepath: string, version?: string, mimetype?: string, pathType: 'SINGLE' | 'MULTI' | 'GET' = 'SINGLE'): string {
        let path = '';

        switch (pathType) {
            case 'MULTI':
                path = this.multiPath;
                break;
            case 'GET':
                path = '/dump.json';
                break;
            case 'SINGLE':
            default:
                path = this.singlePath;
                break;
        }

        const baseUrl = `${this.baseUrl}${path}`;
        const params = new URLSearchParams();

        if (filepath && pathType !== 'GET') params.append('filepath', filepath);
        if (version) params.append('version', version);
        if (mimetype) params.append('mimetype', mimetype);

        return `${baseUrl}${params.toString() ? `?${params.toString()}` : ''}`;
    }

    private getHeaders(contentType?: string): Headers {
        return new Headers({
            ...(this.token && { Authorization: `Bearer ${this.token}` }),
            ...(contentType && { 'Content-Type': contentType })
        });
    }

    private createFormData(props: StorageFileProps | StorageFilesProps, isMultiple = false): FormData {
        const form = new FormData();
        form.append('base_url', process.env.NGINX_INGRESS || '');

        if (!isMultiple) {
            const { filepath, file } = props as StorageFileProps;

            if (file) {
                if (Buffer.isBuffer(file) || typeof file === 'string') {
                    const buffer = Buffer.isBuffer(file) ? file : Buffer.from(file, 'utf-8');
                    form.append('file', buffer, {
                        filename: filepath.split('/').pop(),
                        contentType: 'application/octet-stream'
                    });
                } else {
                    form.append('file', file);
                }
            }

            form.append('unique_name', filepath);
            form.append('destination', filepath);
        } else {
            const { filespath, files } = props as StorageFilesProps;

            if (files && Array.isArray(files)) {
                files.forEach((file, index) => {
                    const filepath = filespath[index];

                    if (Buffer.isBuffer(file) || typeof file === 'string') {
                        const buffer = Buffer.isBuffer(file) ? file : Buffer.from(file, 'utf-8');
                        form.append(`file${index}`, buffer, {
                            filename: filepath.split('/').pop(),
                            contentType: 'application/octet-stream'
                        });
                    } else {
                        form.append(`file${index}`, file);
                    }
                });
            }

            form.append('unique_names', JSON.stringify(filespath));
            form.append('destinations', JSON.stringify(filespath));
        }

        return form;
    }

    async getFile(props: StorageFileProps): Promise<StorageResponse> {
        const { filepath } = props;

        try {
            const response = await fetch(this.generateUrl(filepath), {
                method: 'GET',
                headers: this.getHeaders('application/json'),
                redirect: 'follow'
            });

            if (response.status === 200) {
                const stream = filepath.includes('.json') ? await response.json() : response.body;

                return this.createSuccessResponse(stream);
            }

            return this.createErrorResponse(response.status, `Failed to get file: ${filepath}`);
        } catch (error) {
            logger.error(`Error getting file from distant backend: ${error}`);
            return this.createErrorResponse(500, `Error: ${error}`);
        }
    }

    async upload(props: StorageFileProps): Promise<StorageResponse> {
        const { filepath, file } = props;

        try {
            if (!file) {
                return this.createErrorResponse(400, 'No file content provided');
            }

            const form = this.createFormData(props);
            const formHeaders = form.getHeaders();
            const headers = new Headers({
                ...formHeaders,
                Authorization: `Bearer ${this.token}`
            });

            const response = await fetch(this.generateUrl(filepath), {
                method: 'POST',
                headers,
                body: form,
                redirect: 'follow'
            });

            if (response.status === 401) {
                logger.error('Authentication failed when uploading to distant backend');
                return this.createErrorResponse(401, 'Authentication failed');
            }

            if (response.status === 201 || response.status === 200) {
                return this.createSuccessResponse(null, `File ${filepath} uploaded successfully`);
            }

            return this.createErrorResponse(response.status, `Upload failed: ${response.statusText}`);
        } catch (error) {
            logger.error(`Error uploading file to distant backend: ${error}`);
            return this.createErrorResponse(500, `Error: ${error}`);
        }
    }

    async uploads(props: StorageFilesProps): Promise<StorageResponse> {
        const { filespath, files } = props;

        try {
            if (!Array.isArray(filespath) || !Array.isArray(files) || filespath.length !== files.length) {
                return this.createErrorResponse(400, 'Invalid files or paths provided');
            }

            const form = this.createFormData(props, true);
            const formHeaders = form.getHeaders();
            const headers = new Headers({
                ...formHeaders,
                Authorization: `Bearer ${this.token}`
            });

            const response = await fetch(this.generateUrl('', undefined, undefined, 'MULTI'), {
                method: 'POST',
                headers,
                body: form,
                redirect: 'follow'
            });

            if (response.status === 401) {
                logger.error('Authentication failed when uploading multiple files to distant backend');
                return this.createErrorResponse(401, 'Authentication failed');
            }

            if (response.status === 201 || response.status === 200) {
                return this.createSuccessResponse(null, `${filespath.length} files uploaded successfully`);
            }

            return this.createErrorResponse(response.status, `Uploads failed: ${response.statusText}`);
        } catch (error) {
            logger.error(`Error uploading multiple files to distant backend: ${error}`);
            return this.createErrorResponse(500, `Error: ${error}`);
        }
    }

    async update(props: StorageFileProps): Promise<StorageResponse> {
        const { filepath, file } = props;

        try {
            if (!file) {
                return this.createErrorResponse(400, 'No file content provided');
            }

            const form = this.createFormData(props);
            const formHeaders = form.getHeaders();
            const headers = new Headers({
                ...formHeaders,
                Authorization: `Bearer ${this.token}`
            });

            const response = await fetch(this.generateUrl(filepath), {
                method: 'PUT',
                headers,
                body: form,
                redirect: 'follow'
            });

            if (response.status === 401) {
                logger.error('Authentication failed when updating file on distant backend');
                return this.createErrorResponse(401, 'Authentication failed');
            }

            if (response.status === 201 || response.status === 200) {
                return this.createSuccessResponse(null, `File ${filepath} updated successfully`);
            }

            return this.createErrorResponse(response.status, `Update failed: ${response.statusText}`);
        } catch (error) {
            logger.error(`Error updating file on distant backend: ${error}`);
            return this.createErrorResponse(500, `Error: ${error}`);
        }
    }

    async updates(props: StorageFilesProps): Promise<StorageResponse> {
        const { filespath, files } = props;

        try {
            if (!Array.isArray(filespath) || !Array.isArray(files) || filespath.length !== files.length) {
                return this.createErrorResponse(400, 'Invalid files or paths provided');
            }

            const form = this.createFormData(props, true);
            const formHeaders = form.getHeaders();
            const headers = new Headers({
                ...formHeaders,
                Authorization: `Bearer ${this.token}`
            });

            const response = await fetch(this.generateUrl('', undefined, undefined, 'MULTI'), {
                method: 'PUT',
                headers,
                body: form,
                redirect: 'follow'
            });

            if (response.status === 401) {
                logger.error('Authentication failed when updating multiple files on distant backend');
                return this.createErrorResponse(401, 'Authentication failed');
            }

            if (response.status === 201 || response.status === 200) {
                return this.createSuccessResponse(null, `${filespath.length} files updated successfully`);
            }

            return this.createErrorResponse(response.status, `Multiple updates failed: ${response.statusText}`);
        } catch (error) {
            logger.error(`Error updating multiple files on distant backend: ${error}`);
            return this.createErrorResponse(500, `Error: ${error}`);
        }
    }

    async delete(props: StorageFileProps): Promise<StorageResponse> {
        const { filepath } = props;

        try {
            const form = new FormData();
            form.append('base_url', process.env.NGINX_INGRESS || '');
            form.append('unique_name', filepath);
            form.append('destination', filepath);

            const formHeaders = form.getHeaders();
            const headers = new Headers({
                ...formHeaders,
                Authorization: `Bearer ${this.token}`
            });

            const response = await fetch(this.generateUrl(filepath), {
                method: 'DELETE',
                headers,
                body: form,
                redirect: 'follow'
            });

            if (response.status === 401) {
                logger.error('Authentication failed when deleting file from distant backend');
                return this.createErrorResponse(401, 'Authentication failed');
            }

            if (response.status === 201 || response.status === 200) {
                return this.createSuccessResponse(null, `File ${filepath} deleted successfully`);
            }

            return this.createErrorResponse(response.status, `Delete failed: ${response.statusText}`);
        } catch (error) {
            logger.error(`Error deleting file from distant backend: ${error}`);
            return this.createErrorResponse(500, `Error: ${error}`);
        }
    }

    async deleteFiles(props: StorageFilesProps): Promise<StorageResponse> {
        const { filespath } = props;

        try {
            if (!Array.isArray(filespath)) {
                return this.createErrorResponse(400, 'No file paths provided or invalid format');
            }

            const form = new FormData();
            form.append('base_url', process.env.NGINX_INGRESS || '');
            form.append('unique_names', JSON.stringify(filespath));
            form.append('destinations', JSON.stringify(filespath));

            const formHeaders = form.getHeaders();
            const headers = new Headers({
                ...formHeaders,
                Authorization: `Bearer ${this.token}`
            });

            const response = await fetch(this.generateUrl('', undefined, undefined, 'MULTI'), {
                method: 'DELETE',
                headers,
                body: form,
                redirect: 'follow'
            });

            if (response.status === 401) {
                logger.error('Authentication failed when deleting multiple files from distant backend');
                return this.createErrorResponse(401, 'Authentication failed');
            }

            if (response.status === 201 || response.status === 200) {
                return this.createSuccessResponse(null, `${filespath.length} files deleted successfully`);
            }

            return this.createErrorResponse(response.status, `Multiple deletes failed: ${response.statusText}`);
        } catch (error) {
            logger.error(`Error deleting multiple files from distant backend: ${error}`);
            return this.createErrorResponse(500, `Error: ${error}`);
        }
    }

    async getLastDump(): Promise<StorageResponse> {
        try {
            const response = await fetch(this.generateUrl('', undefined, undefined, 'GET'), {
                method: 'GET',
                headers: this.getHeaders('application/json'),
                redirect: 'follow'
            });

            if (response.status !== 200) {
                return this.createErrorResponse(response.status, 'Failed to get backup JSON file');
            }

            const files = await response.json();

            if (Array.isArray(files) && files.length > 0) {
                await this.catalogService.addFiles(files);
            }

            return this.createSuccessResponse(files, 'Successfully loaded latest dump');
        } catch (error) {
            logger.error(`Error getting last dump from distant backend: ${error}`);
            return this.createErrorResponse(500, `Error: ${error}`);
        }
    }

    async createDump(data: any): Promise<StorageResponse> {
        try {
            const form = new FormData();
            form.append('file', Buffer.from(JSON.stringify(data)), {
                filename: 'dump.json',
                contentType: 'application/json'
            });

            const formHeaders = form.getHeaders();
            const headers = new Headers({
                ...formHeaders,
                Authorization: `Bearer ${this.token}`
            });

            const response = await fetch(this.generateUrl('/dump.json'), {
                method: 'POST',
                headers,
                body: form,
                redirect: 'follow'
            });

            if (response.status === 201 || response.status === 200) {
                return this.createSuccessResponse(null, 'Dump created successfully');
            }

            return this.createErrorResponse(response.status, `Failed to create dump: ${response.statusText}`);
        } catch (error) {
            logger.error(`Error creating dump on distant backend: ${error}`);
            return this.createErrorResponse(500, `Error: ${error}`);
        }
    }
}
