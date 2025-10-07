import { logger } from '../../utils/logs/winston';

type Job = {
    id: number;
    fn: () => Promise<void>;
};

type QueueState = {
    queue: Job[];
    processing: boolean;
    jobIdCounter: number;
};

const queueState: QueueState = {
    queue: [],
    processing: false,
    jobIdCounter: 0
};

const processNext = async (): Promise<void> => {
    if (queueState.queue.length === 0) {
        queueState.processing = false;
        return;
    }

    queueState.processing = true;
    const job = queueState.queue.shift();

    if (job) {
        logger.info(`Processing job ${job.id}...`);
        try {
            await job.fn();
            logger.info(`Job ${job.id} done.`);
        } catch (e) {
            logger.error(`Error in job ${job.id} :`, e);
        }
        await processNext();
    }
};

const addJob = async (fn: () => Promise<void>): Promise<number> => {
    const job: Job = {
        id: queueState.jobIdCounter++,
        fn
    };

    queueState.queue.push(job);

    if (!queueState.processing) {
        processNext();
    }

    return job.id;
};

export const globalQueue = {
    add: addJob
};
