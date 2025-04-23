import { Router } from 'express';
import { globalQueue } from "../middleware/queues/inMemoryQueue";
const router = Router();

router.get('/queue-status', (req, res) => {
    res.json({
        enCours: globalQueue.isProcessing(),
        enAttente: globalQueue.getCurrentQueue()
    });
});

export { router };