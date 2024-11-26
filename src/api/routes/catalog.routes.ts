import { createDump, getFile, getFiles, deleteCatalog, updateFileInCatalog, addFileInCatalog } from '../controllers/catalog.controller';
import { Router } from 'express';
import { deleteCatalogItem } from '../catalog';
import { redisConnectionMiddleware } from '../middleware/redisMiddleware';

const router = Router();

router.use(redisConnectionMiddleware);

router.get(`/catalog`, getFiles);

router.get(`/catalog/:id`, getFile);

router.post(`/catalog`, addFileInCatalog);

router.patch(`/catalog/:id`, updateFileInCatalog);

router.delete(`/catalog/:id`, deleteCatalogItem);

router.delete(`/catalog`, deleteCatalog);

router.post(`/catalog/create-dump`, createDump);

export { router };
