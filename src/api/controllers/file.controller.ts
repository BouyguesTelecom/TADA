import { Request, Response } from 'express';
import { ICatalogService } from '../../core/interfaces/Icatalog';
import { CatalogService } from '../../core/services/catalog.service';
import { FileService } from '../../core/services/file.service';
import { StorageFactory } from '../../infrastructure/storage/factory';

export class FileController {
    private fileService: FileService;
    private catalogService: ICatalogService;

    constructor() {
        const storage = StorageFactory.createStorage();
        this.catalogService = new CatalogService();
        this.fileService = new FileService(storage, this.catalogService);
    }

    async getAsset(req: Request, res: Response): Promise<void> {
        try {
            const { format, ...params } = req.params;
            const uuid = params['0'];
            const result = await this.catalogService.getFile({ uuid });

            if (result.status !== 200 || !result.datum) {
                res.status(result.status || 404).json({ error: result.error || 'File not found' });
                return;
            }

            const fileData = await this.fileService.getFile(result.datum.uuid);
            if (!fileData.buffer) {
                res.status(404).json({ error: 'File content not found' });
                return;
            }

            res.status(200).send(fileData.buffer);
        } catch (error) {
            res.status(500).json({ error: 'Failed to get asset' });
        }
    }

    async postAsset(req: Request, res: Response): Promise<void> {
        try {
            if (!req.file) {
                res.status(400).json({ error: 'No file provided' });
                return;
            }

            const result = await this.fileService.uploadFile(
                req.file.buffer,
                {
                    filename: req.file.originalname,
                    mimetype: req.file.mimetype,
                    size: req.file.size,
                    ...req.body
                },
                {
                    namespace: req.body.namespace,
                    stripMetadata: true,
                    convertToWebp: req.body.toWebp
                }
            );

            res.status(result.status).json(result);
        } catch (error) {
            res.status(500).json({ error: 'Failed to upload file' });
        }
    }

    async patchAsset(req: Request, res: Response): Promise<void> {
        try {
            const { uuid } = req.params;
            const fileResult = await this.catalogService.getFile({ uuid });

            if (fileResult.status !== 200 || !fileResult.datum) {
                res.status(fileResult.status || 404).json({ error: fileResult.error || 'File not found' });
                return;
            }

            const result = await this.fileService.updateFile(
                uuid,
                req.file?.buffer || null,
                {
                    ...req.body,
                    ...(req.file && {
                        filename: req.file.originalname,
                        mimetype: req.file.mimetype,
                        size: req.file.size
                    })
                },
                {
                    stripMetadata: true,
                    convertToWebp: req.body.toWebp
                }
            );

            res.status(result.status).json(result);
        } catch (error) {
            res.status(500).json({ error: 'Failed to update file' });
        }
    }

    async deleteAsset(req: Request, res: Response): Promise<void> {
        try {
            const { uuid } = req.params;
            const fileResult = await this.catalogService.getFile({ uuid });

            if (fileResult.status !== 200 || !fileResult.datum) {
                res.status(fileResult.status || 404).json({ error: fileResult.error || 'File not found' });
                return;
            }

            const result = await this.fileService.deleteFile(uuid);
            res.status(result.status).json(result);
        } catch (error) {
            res.status(500).json({ error: 'Failed to delete file' });
        }
    }
}
