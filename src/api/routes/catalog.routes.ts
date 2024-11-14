import { createDump, getFile, getFiles, deleteCatalog } from '../controllers/catalog.controller';
import { Router } from 'express';

const router = Router();

router.get(`/catalog`, getFiles);

router.get(`/catalog/create-dump`, createDump);

router.get(`/catalog/:id`, getFile);

router.delete(`/catalog`, deleteCatalog);

export { router };
