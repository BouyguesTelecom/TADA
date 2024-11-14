import * as dotenv from 'dotenv';
dotenv.config();

import { processCatalog } from './utils/backup_and_clean';

const launchBackupAndCleanJob = async () => {
    await processCatalog();
    process.exit(0);
};

launchBackupAndCleanJob();
