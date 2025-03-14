import fs from 'fs';
import path from 'path';
import { logger } from '../../../utils/logs/winston';

export class StandaloneUtils {
    // Remove the last part of a path
    public static removeLastPartPath(url: string): string {
        const segments = url.split('/');
        segments.pop();
        return segments.join('/');
    }

    // Create a folder in the standalone storage
    public static createFolder(folderPath: string): { status: number } {
        if (folderPath && !fs.existsSync(`/tmp/standalone${folderPath}`)) {
            logger.info(`Creating folder: ${folderPath} under /tmp/standalone`);
            try {
                fs.mkdirSync(`/tmp/standalone${folderPath}`, { recursive: true });
                logger.info(`Folder created successfully: ${folderPath}`);
                return { status: 200 };
            } catch (error) {
                if (error.code !== 'EEXIST') {
                    logger.error(`Failed to create folder ${folderPath}: ${error}`);
                    return { status: 400 };
                }
            }
        }

        if (folderPath) {
            logger.info(`${folderPath} already exists in PV /tmp/standalone`);
            return { status: 304 };
        }

        logger.info(`No folder created, file located at root`);
        return { status: 200 };
    }

    // Write a file to the standalone storage
    public static async writeFileInPV(resourcePath: string, data: Buffer | string): Promise<boolean> {
        try {
            // Create directory structure if it doesn't exist
            const dir = path.dirname(`/tmp/standalone${resourcePath}`);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            await fs.promises.writeFile(`/tmp/standalone${resourcePath}`, data);
            logger.info(`File ${resourcePath} saved successfully under /tmp/standalone${resourcePath}`);
            return true;
        } catch (err) {
            logger.error(`Failed to save file ${resourcePath} in PV under /tmp/standalone${resourcePath}`, err);
            return false;
        }
    }

    // Delete a file from the standalone storage
    public static async deleteFile(filePath: string): Promise<boolean> {
        try {
            await fs.promises.unlink(filePath);
            logger.info(`File ${filePath} deleted successfully`);
            return true;
        } catch (err) {
            logger.error(`Failed to delete file ${filePath}`, err);
            return false;
        }
    }

    // Read a file from the standalone storage
    public static async readFile(filePath: string): Promise<Buffer | null> {
        try {
            return await fs.promises.readFile(filePath);
        } catch (err) {
            logger.error(`Failed to read file ${filePath}`, err);
            return null;
        }
    }

    // Check if a file exists in the standalone storage
    public static fileExists(filePath: string): boolean {
        return fs.existsSync(filePath);
    }
}
