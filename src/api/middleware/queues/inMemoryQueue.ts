type Job = {
    id: number;
    fn: () => Promise<void>;
};

export class InMemoryQueue {
    private queue: Job[] = [];
    private processing = false;
    private jobIdCounter = 0;

    async add(fn: () => Promise<void>): Promise<number> {
        const job: Job = { id: this.jobIdCounter++, fn };
        this.queue.push(job);

        if (!this.processing) {
            this.processNext();
        }

        return job.id;
    }

    private async processNext() {
        if (this.queue.length === 0) {
            this.processing = false;
            return;
        }

        this.processing = true;
        const job = this.queue.shift();
        if (job) {
            console.log(`Processing job ${job.id}...`);
            try {
                await job.fn();
                console.log(`Job ${job.id} done.`);
            } catch (e) {
                console.error(`Error in job ${job.id} :`, e);
            }
            this.processNext();
        }
    }

    getCurrentQueue(): number[] {
        return this.queue.map((job) => job.id);
    }

    isProcessing(): boolean {
        return this.processing;
    }
}

export const globalQueue = new InMemoryQueue();
