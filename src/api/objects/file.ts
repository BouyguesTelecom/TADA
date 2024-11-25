import fs from 'fs';
import app from '../app';
import { catalogHandler } from './catalog';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { deleteFile, writeFileInPV, createFolder, removeLastPartPath } from '../utils/standalone';

class FileHandler {
    async getFile(filePath, file): Promise<{ status: number, streamBuffer: ArrayBuffer }> {
        if (process.env.STANDALONE) {
            try {
                const backupFilePath = `/tmp/standalone${ filePath }`;
                const fileContent = fs.readFileSync(backupFilePath);
                return { status: 200, streamBuffer: Buffer.from(fileContent) };
            } catch ( error ) {
                return null;
            }
        }
        const response = await fetch(`${ app.locals.PREFIXED_API_URL }/backup?filepath=${ filePath }&version=${ file.version }&mimetype=${ file.mimetype }`);
        return { status: response.status, streamBuffer: await response.arrayBuffer() };

    }

    async postFile(uniqueName, file, stream): Promise<{ status: number, errors?: string[], purge?: string | null }> {
        if (process.env.STANDALONE) {
            try {
                await createFolder(removeLastPartPath(uniqueName));
                await writeFileInPV(uniqueName, stream);
                return {
                    status: 200
                };
            } catch ( error ) {
                console.log(error, 'ERROR ICIIIII');
                return {
                    status: 400,
                    errors: [ `Failed to write file in /tmp/standalone under /tmp/standalone${ uniqueName }` ]
                };
            }
        }
        const form = new FormData();
        form.append('file', stream, { filename: uniqueName, contentType: file.mimetype });
        const postBackupFile = await fetch(`${ app.locals.PREFIXED_API_URL }/backup?filepath=${ uniqueName }&version=1&mimetype=${ file.mimetype }`, {
            method: 'POST',
            body: form
        });

        if (postBackupFile.status !== 200) {
            await catalogHandler.deleteItem(uniqueName);
            return { status: 400, errors: [ 'Failed to upload in backup' ] };
        }

        return { status: 200, purge: 'catalog' };
    }

    async patchFile(uniqueName, file, stream, itemToUpdate): Promise<{ status: number, errors?: string[], purge?: string | null }> {
        if (process.env.STANDALONE) {
            try {
                await createFolder(removeLastPartPath(uniqueName));
                await writeFileInPV(uniqueName, stream);
                return { status: 200 };
            } catch ( error ) {
                return {
                    status: 400,
                    errors: [ `Failed to write & update file in /tmp/standalone under /tmp/standalone${ uniqueName }` ]
                };
            }
        }

        const form = new FormData();
        form.append('file', stream, {
            filename: uniqueName,
            contentType: file.mimetype
        });

        const patchBackupFile = await fetch(`${ app.locals.PREFIXED_API_URL }/backup?filepath=${ itemToUpdate.unique_name }&version=${ itemToUpdate.version }&mimetype=${ itemToUpdate.mimetype }`, {
            method: 'PATCH',
            body: form
        });

        if (patchBackupFile.status !== 200) {
            await catalogHandler.deleteItem(uniqueName);
        }
    }

    async deleteFile(uniqueName: string, itemToUpdate): Promise<{ status: number, errors?: string[] }> {
        if (process.env.STANDALONE) {
            try {
                const deletedFile = await deleteFile(`/tmp/standalone${ uniqueName }`);
                return { status: deletedFile ? 200 : 400, ...( !deletedFile && { errors: [ 'Failed to delete' ] } ) };
            } catch ( error ) {
                return {
                    status: 400,
                    errors: [ `Failed to delete file in /tmp/standalone under /tmp/standalone/${ uniqueName }` ]
                };
            }
        }
        const deleteBackupFile = await fetch(`${ app.locals.PREFIXED_API_URL }/backup?filepath=${ itemToUpdate.unique_name }&version=${ itemToUpdate.version }&mimetype=${ itemToUpdate.mimetype }`, {
            method: 'DELETE'
        });

        if (deleteBackupFile.status !== 200) {
            return {
                status: 500,
                errors: [ `File not removed from backup` ]
            };
        }
        return { status: 200 };
    }
}

export const fileHandler = new FileHandler();