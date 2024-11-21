import fs from 'fs';
import app from '../app';

class FileHandler {
    async getFile(filePath, file): Promise<{ status: number, streamBuffer: ArrayBuffer }> {
        if (process.env.STANDALONE) {
            try {
                const backupFilePath = `/tmp/standalone/${ filePath }`;
                const fileContent = fs.readFileSync(backupFilePath);
                return { status: 200, streamBuffer: Buffer.from(fileContent) };
            } catch ( error ) {
                return null;
            }
        } else {
            const response = await fetch(`${ app.locals.PREFIXED_API_URL }/backup?filepath=${ filePath }&version=${ file.version }&mimetype=${ file.mimetype }`);
            return { status: response.status, streamBuffer: await response.arrayBuffer() };
        }
    }

}

export const fileHandler = new FileHandler();