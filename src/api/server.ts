import fs from 'fs';
import { Server } from 'http';
import fetch from 'node-fetch';
import { CatalogService } from '../core/services/catalog.service';
import { StorageService } from '../core/services/storage.service';
import { RedisHandler } from '../infrastructure/persistence/redis/connection';
import { logger } from '../utils/logs/winston';
import { Application } from './app';

export class ApplicationServer {
    private readonly port: number;
    private readonly isStandalone: boolean;
    private readonly app: Application;
    private readonly catalogService: CatalogService;
    private readonly storageService: StorageService;
    private readonly redisConnection: RedisHandler;
    private server: Server | null = null;

    constructor() {
        this.port = parseInt(process.env.PORT || '3001', 10);
        this.isStandalone = process.env.DELEGATED_STORAGE_METHOD === 'STANDALONE';
        this.app = new Application();
        this.catalogService = new CatalogService();
        this.storageService = new StorageService();
        this.redisConnection = RedisHandler.getInstance();
    }

    private async checkAccessToBackup(): Promise<void> {
        const backupUrl = `${process.env.DELEGATED_STORAGE_HOST}${process.env.DELEGATED_STORAGE_READINESS_CHECK}`;

        try {
            const checkBackup = await fetch(backupUrl);
            if (checkBackup.status !== 200) {
                throw new Error(`Backup access failed: ${checkBackup.status}`);
            }

            logger.info(`Backup access OK: ${backupUrl}`);
        } catch (error) {
            logger.error(`Backup check failed: ${error.message}`);
            throw error;
        }
    }

    private async connectToRedisWithRetry(maxRetries: number = 3, delay: number = 10000): Promise<void> {
        let attempts = 0;

        while (attempts < maxRetries) {
            try {
                await this.redisConnection.connectClient();
                await this.catalogService.getFiles();
                return;
            } catch (error) {
                attempts++;
                logger.error(`Failed to connect to Redis. Attempt ${attempts} of ${maxRetries}`);

                if (attempts === maxRetries) {
                    throw new Error('Maximum connection attempts to Redis reached');
                }

                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }

    private createStandaloneFolderAndCatalog(): void {
        const standaloneDir = '/tmp/standalone';
        const catalogPath = `${standaloneDir}/catalog.json`;

        if (!fs.existsSync(standaloneDir)) {
            logger.info('Creating /tmp/standalone...');
            fs.mkdirSync(standaloneDir, { recursive: true });
        }

        if (!fs.existsSync(catalogPath)) {
            fs.writeFileSync(catalogPath, JSON.stringify({ data: [] }));
        }
    }

    private async initializeStorage(): Promise<void> {
        if (!this.isStandalone) {
            await this.checkAccessToBackup();
            await this.connectToRedisWithRetry();

            const dbDump = fs.existsSync(`${process.env.DUMP_FOLDER_PATH}/dump.rdb`);

            if (!dbDump) {
                logger.info("dump.rdb doesn't exist: getting latest dump from backup ✅");
                const dumpResponse = await this.storageService.getLastDump();

                if (dumpResponse.status !== 200) {
                    throw new Error(`Failed to get last dump: ${dumpResponse.message}`);
                }

                await this.redisConnection.generateDump();
            } else {
                logger.info('dump.rdb already exists: skipping getting latest dump from backup 🔆');
            }

            await this.redisConnection.disconnectClient();
        } else {
            this.createStandaloneFolderAndCatalog();
        }
    }

    public async start(): Promise<void> {
        try {
            await this.initializeStorage();

            this.server = this.app.getApp().listen(this.port, () => {
                logger.info(`\n✨  ${this.isStandalone ? 'Using fs in standalone mode' : 'Connected to Redis'}, ` + `server running => http://localhost:${this.port}\n`);
            });

            this.server.on('error', (error: Error) => {
                logger.error(`Server error: ${error.message}`);
                this.stop();
            });
        } catch (error) {
            logger.error(`Error starting app: ${error.message}`);
            process.exit(1);
        }
    }

    public stop(): void {
        if (this.server) {
            this.server.close(() => {
                logger.info('Server stopped');
                process.exit(1);
            });
        }
    }
}

const server = new ApplicationServer();
server.start().catch((error) => {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    logger.error(`Uncaught Exception: ${error.message}`);
    server.stop();
});

process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled Rejection: ${reason}`);
    server.stop();
});
