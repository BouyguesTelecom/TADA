import { addOneFile, getAllFiles, getCatalog, getOneFile } from '../utils/redis/operations';
import fs from 'fs';
import { addFileInCatalog, deleteFileFromCatalog, updateFileInCatalog } from '../controllers/catalog.controller';
import { connectClient, disconnectClient } from '../utils/redis/connection';
import { purgeData } from '../middleware/validators/utils';
import { logger } from '../utils/logs/winston';

class CatalogHandler {
    async getAll() {
        if (process.env.STANDALONE) {
            const catalog = JSON.parse(fs.readFileSync('/tmp/standalone/catalog.json', 'utf8'));
            if (catalog) {
                return { status: 200, data: catalog.data };
            }
            return { status: 400, errors: [ 'Failed to read catalog /tmp/standalone/catalog.json' ] };
        }
        try {
            await connectClient();
            const response = await getAllFiles();
            if (response.data && ( !response.errors || response.errors.length === 0 )) {
                return { status: 200, data: response.data };
            }
            return { status: 500, errors: response.errors };
        } catch ( err: unknown ) {
            logger.error(`Error getting files: ${ err }`);
            return { status: 500, errors: [ `Error getting files: ${ err }` ] };
        } finally {
            await disconnectClient();
        }
    }

    async getItem(uuid) {
        if (process.env.STANDALONE) {
            const catalog = JSON.parse(fs.readFileSync('/tmp/standalone/catalog.json', 'utf8')).data;
            const file = catalog.find((item) => item.uuid === uuid);
            return {
                status: file ? 200 : 404,
                data: file ?? null,
                errors: file ? null : [ `Failed to read item ${ uuid } in /tmp/standalone/catalog.json ` ]
            };
        }
        try {
            await connectClient();
            const response = await getOneFile(uuid);
            if (response.data && ( !response.errors || response.errors.length === 0 )) {
                return { status: 200, data: response.data };
            }
            return {
                status: 404, data: null,
                errors: [ `Unable to find file with id ${ uuid } => ${ response.errors?.join(', ') }` ]
            };
        } catch ( err: unknown ) {
            logger.error(`Error getting file: ${ err }`);
            return {status: 500, data: null, errors: [ `Error getting file: ${ err }` ] };
        } finally {
            await disconnectClient();
        }
    }

    async addItem(item) {
        if (process.env.STANDALONE) {
            const catalog = JSON.parse(fs.readFileSync('/tmp/standalone/catalog.json', 'utf8')).data;
            fs.writeFileSync('/tmp/standalone/catalog.json', JSON.stringify({ data: [ ...catalog, item ] }));
            return {
                status: 200,
                message: `Item added with uuid: ${ item.uuid }`,
                data: [ item ]
            };
        }
        try {
            await connectClient();
            const response = await addOneFile(item);
            await purgeData('catalog');
            if (response.data && ( !response.errors || response.errors.length === 0 )) {
                return {
                    status: 200,
                    message: `Item added with uuid: ${ response.data.uuid }`,
                    data: response.data
                };
            }
            return {
                status: 500,
                message: response.errors?.join(', ') || 'Unknown error',
                data: null
            };
        } catch ( err: unknown ) {
            logger.error(`Error adding file: ${ err }`);
            return {
                status: 500,
                message: `Error adding file: ${ err }`,
                data: null
            };
        } finally {
            await disconnectClient();
        }
    }

    async updateItem(uuid, item) {
        if (process.env.STANDALONE) {
            const catalog = JSON.parse(fs.readFileSync('/tmp/standalone/catalog.json', 'utf8')).data;
            const updatedCatalog = catalog.map((catalogItem) => {
                if (catalogItem.uuid === uuid) { return { ...catalogItem, ...item };}
                return catalogItem;
            });
            fs.writeFileSync('/tmp/standalone/catalog.json', JSON.stringify({ data: updatedCatalog }));
            return item;
        }

        return await updateFileInCatalog(item.uuid, item);
    }

    async deleteItem(uniqueName) {
        if (process.env.STANDALONE) {
            const catalog = JSON.parse(fs.readFileSync('/tmp/standalone/catalog.json', 'utf8')).data;
            const updatedCatalog = catalog.filter((catalogItem) => catalogItem.unique_name !== uniqueName);
            fs.writeFileSync('/tmp/standalone/catalog.json', JSON.stringify({ data: updatedCatalog }));
            return updatedCatalog.find(item => item.unique_name === uniqueName);
        }
        return await deleteFileFromCatalog(uniqueName);
    }

}

export const catalogHandler = new CatalogHandler();