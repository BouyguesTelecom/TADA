import { getCatalog, getOneFile } from '../utils/redis/operations';
import fs from 'fs';
import { addFileInCatalog, deleteFileFromCatalog, updateFileInCatalog } from '../controllers/catalog.controller';

class CatalogHandler {
    async getAll() {
        if (process.env.STANDALONE) {
            return JSON.parse(fs.readFileSync('/tmp/standalone/catalog.json', 'utf8'));
        }
        return await getCatalog();
    }

    async getItem(uuid) {
        if (process.env.STANDALONE) {
            const catalog = JSON.parse(fs.readFileSync('/tmp/standalone/catalog.json', 'utf8')).data;
            const file = catalog.find((item) => item.uuid === uuid);
            return {
                data: file ?? null,
                errors: null
            };
        }
        return await getOneFile(uuid);
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
        return await addFileInCatalog(item);
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