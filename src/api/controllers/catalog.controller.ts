import { Request, Response } from 'express';
import catalogService from '../../core/services/catalog.service';

export class CatalogController {
    async getFiles(req: Request, res: Response): Promise<void> {
        try {
            const result = await catalogService.getFiles();
            res.status(result.status).json(result);
        } catch (error) {
            res.status(500).json({ error: 'Failed to retrieve files from catalog' });
        }
    }

    async getFile(req: Request, res: Response): Promise<void> {
        try {
            const result = await catalogService.getFile({ uuid: req.params.id });
            res.status(result.status).json(result);
        } catch (error) {
            res.status(500).json({ error: 'Failed to get file' });
        }
    }

    async addFile(req: Request, res: Response): Promise<void> {
        try {
            const result = await catalogService.addFile(req.body);
            res.status(result.status).json(result);
        } catch (error) {
            res.status(500).json({ error: 'Failed to add file' });
        }
    }

    async updateFile(req: Request, res: Response): Promise<void> {
        try {
            const result = await catalogService.updateFile(req.params.id, req.body);
            res.status(result.status).json(result);
        } catch (error) {
            res.status(500).json({ error: 'Failed to update file' });
        }
    }

    async deleteFile(req: Request, res: Response): Promise<void> {
        try {
            const result = await catalogService.deleteFile(req.params.id);
            res.status(result.status).json(result);
        } catch (error) {
            res.status(500).json({ error: 'Failed to delete file' });
        }
    }

    async deleteAllFiles(req: Request, res: Response): Promise<void> {
        try {
            const result = await catalogService.deleteAllFiles();
            res.status(result.status).json(result);
        } catch (error) {
            res.status(500).json({ error: 'Failed to delete all files from catalog' });
        }
    }

    async createDump(req: Request, res: Response): Promise<void> {
        try {
            const result = await catalogService.createDump();
            res.status(result.status).json(result);
        } catch (error) {
            res.status(500).json({ error: 'Failed to create catalog dump' });
        }
    }
}

const catalogController = new CatalogController();
export default catalogController;
