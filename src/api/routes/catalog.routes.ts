import { createDump, getFile, getFiles, deleteCatalog, updateFileInCatalog } from '../controllers/catalog.controller';
import { Router } from 'express';

const router = Router();

router.get(`/catalog`, getFiles);

router.get(`/catalog/:id`, getFile);

router.post(`/catalog`, getFile);

router.patch(`/catalog/:id`, getFile);

router.delete(`/catalog`, deleteCatalog);

router.get(`/catalog/create-dump`, createDump);

export { router };
