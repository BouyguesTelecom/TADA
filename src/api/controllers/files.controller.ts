import { Request, Response } from 'express';
import { CatalogService } from '../../core/services/catalog.service';
import { FileService } from '../../core/services/file.service';
import { StorageFactory } from '../../infrastructure/storage/factory';

export class FilesController {
    private fileService: FileService;

    constructor() {
        const storage = StorageFactory.createStorage();
        const catalogService = new CatalogService();
        this.fileService = new FileService(storage, catalogService);
    }

    async postAssets(req: Request, res: Response): Promise<void> {
        try {
            if (!req.files || !Array.isArray(req.files)) {
                res.status(400).json({ error: 'No files provided' });
                return;
            }

            const files = (req.files as Express.Multer.File[]).map((file) => ({
                buffer: file.buffer,
                metadata: {
                    filename: file.originalname,
                    mimetype: file.mimetype,
                    size: file.size,
                    ...req.body
                }
            }));

            const result = await this.fileService.uploadFiles(files, {
                namespace: req.body.namespace,
                stripMetadata: true,
                convertToWebp: req.body.toWebp
            });

            res.status(result.status).json(result);
        } catch (error) {
            res.status(500).json({ error: 'Failed to upload files' });
        }
    }

    async patchAssets(req: Request, res: Response): Promise<void> {
        try {
            const { uuids, ...updateData } = req.body;
            const files = req.files as Express.Multer.File[];

            const results = await Promise.all(
                uuids.map(async (uuid: string) => {
                    const file = files?.find((f) => f.originalname === uuid);
                    return this.fileService.updateFile(uuid, file ? file.buffer : null, updateData, {
                        stripMetadata: true,
                        convertToWebp: req.body.toWebp
                    });
                })
            );

            const successResults = results.filter((r) => r.status === 200);
            const errorResults = results.filter((r) => r.status !== 200);

            res.status(errorResults.length ? 207 : 200).json({
                status: errorResults.length ? 207 : 200,
                data: successResults.map((r) => r.datum),
                errors: errorResults.map((r) => r.error)
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to update files' });
        }
    }

    async deleteAssets(req: Request, res: Response): Promise<void> {
        try {
            const { uuids } = req.body;
            const results = await Promise.all(uuids.map((uuid) => this.fileService.deleteFile(uuid)));

            const successResults = results.filter((r) => r.status === 200);
            const errorResults = results.filter((r) => r.status !== 200);

            res.status(errorResults.length ? 207 : 200).json({
                status: errorResults.length ? 207 : 200,
                data: successResults.map((r) => r.datum),
                errors: errorResults.map((r) => r.error)
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to delete files' });
        }
    }
}
