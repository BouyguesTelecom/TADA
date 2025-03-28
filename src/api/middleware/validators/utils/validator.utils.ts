import { Response } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { findFileInCatalog } from '../../../../utils/catalog';

export interface ValidatorResponse {
    success: boolean;
    message: string;
    data?: any;
    errors?: string[];
}

export class ValidatorUtils {
    private static instance: ValidatorUtils;
    private multerStorage: multer.StorageEngine;

    private constructor() {
        this.multerStorage = multer.diskStorage({
            filename: (_req, file, callback) => {
                const convertToWebp = ['image/png', 'image/jpeg'].includes(file.mimetype) && !(_req.body.toWebp === 'false');
                let filename = _req.body.filename ? _req.body.filename : file.originalname;

                const ext = path.extname(filename);
                const name = path.basename(filename, ext);

                const sanitizedFilename = name.replace(/[^a-zA-Z0-9\-@_%]+/g, '_') + ext;
                const finalFilename = convertToWebp ? sanitizedFilename.replace(ext, '.webp') : sanitizedFilename;

                callback(null, finalFilename);
            },
            destination: (_req, _file, callback) => {
                const path = `/tmp`;
                if (!fs.existsSync(`${path}`)) {
                    fs.mkdirSync(`${path}`, { recursive: true });
                }
                callback(null, `${path}`);
            }
        });
    }

    public static getInstance(): ValidatorUtils {
        if (!ValidatorUtils.instance) {
            ValidatorUtils.instance = new ValidatorUtils();
        }
        return ValidatorUtils.instance;
    }

    public getMulterStorage(): multer.StorageEngine {
        return this.multerStorage;
    }

    public async purgeData(data: any): Promise<void> {
        const safeFetch = async (url: string): Promise<void> => {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    console.warn(`Warning: Fetch to ${url} responded with status: ${response.status}`);
                }
            } catch (error) {
                console.warn(`Warning: Fetch to ${url} failed: ${error.message}`);
            }
        };

        if (data === 'catalog') {
            await safeFetch(`${process.env.NGINX_SERVICE}/purge${process.env.API_PREFIX}/catalog`);
        }

        if (data && data.length && typeof data[0] === 'object') {
            for (const file of data) {
                await safeFetch(`${process.env.NGINX_SERVICE}/purge${process.env.API_PREFIX}/assets/media/original${file.unique_name}`);
                await safeFetch(`${process.env.NGINX_SERVICE}/purge${process.env.API_PREFIX}/assets/media/full${file.unique_name}`);
            }
        }
    }

    public async sendResponse({ res, status, data = null, errors = null, purge = 'false' }: { res: Response; status: number; data?: any; errors?: any; purge?: string }): Promise<void> {
        if (purge !== 'false' && process.env.DELEGATED_STORAGE_METHOD !== 'STANDALONE') {
            await this.purgeData(purge === 'catalog' ? 'catalog' : data);
        }
        res.status(status).json({ data, errors }).end();
    }

    public checkNamespace(namespace: string): boolean {
        return process.env.NAMESPACES?.split(',').includes(namespace) || false;
    }

    public checkMissingParam(requiredParams: string[], params: Record<string, any>): string[] {
        return requiredParams.filter((param) => !params.hasOwnProperty(param));
    }

    public generateUniqueName(file: Express.Multer.File, body: any, namespace: string, toWebp: boolean): string {
        if (!file) return '';

        const destination = body.destination ? `${body.destination}/` : '';
        const filename = toWebp && ['image/jpeg', 'image/png'].includes(file.mimetype) ? file.filename.split('.')[0] + '.webp' : file.filename;

        return `/${namespace}/${destination}${filename}`;
    }

    public async fileIsTooLarge(file: Express.Multer.File, params: { uuid: string; namespace: string }, method: string = 'POST'): Promise<ValidatorResponse | null> {
        if (file && file.size > 10000000) {
            const itemFound = method === 'PATCH' && (await findFileInCatalog(params.uuid, 'uuid'));
            return {
                success: false,
                message: 'File too large: cannot exceed 10mb',
                data: {
                    filename: file.filename,
                    size: file.size,
                    ...itemFound
                }
            };
        }
        return null;
    }

    public isFileNameInvalid(file: Express.Multer.File): string | false {
        const fileNameSplitted = file.filename.split('.');
        if (!(fileNameSplitted.length > 0)) return "Filename doesn't contain extension.";

        const allowedCharsRegex = /^[a-zA-Z0-9\-@_%]+$/;
        if (file.filename.length > 90) return 'Filename is too long.';
        if (!allowedCharsRegex.test(fileNameSplitted[0])) return 'Filename contains forbidden chars.';

        return false;
    }
}
