import fs from 'fs';
import { FileProps, ICatalogResponse, ICatalogResponseMulti } from '../../props/catalog';

export const addFileInCatalog = async (item: FileProps): Promise<ICatalogResponse> => {
    const catalog = JSON.parse(fs.readFileSync('/tmp/standalone/catalog.json', 'utf8')).data;
    fs.writeFileSync('/tmp/standalone/catalog.json', JSON.stringify({ data: [...catalog, item] }));
    return {
        status: 200,
        datum: item,
        error: null
    };
};
export const addFilesInCatalog = async (items: FileProps[]): Promise<ICatalogResponseMulti> => {
    const catalog = JSON.parse(fs.readFileSync('/tmp/standalone/catalog.json', 'utf8')).data;
    fs.writeFileSync('/tmp/standalone/catalog.json', JSON.stringify({ data: [...catalog, ...items] }));
    return {
        status: 200,
        data: items,
        errors: null
    };
};

export const getFiles = async (): Promise<ICatalogResponseMulti> => {
    const catalog = JSON.parse(fs.readFileSync('/tmp/standalone/catalog.json', 'utf8'));
    if (catalog) {
        return { status: 200, data: catalog.data, errors: null };
    }
    return { status: 400, errors: ['Failed to read catalog /tmp/standalone/catalog.json'], data: null };
};

export const getFile = async (uuid): Promise<ICatalogResponse> => {
    const catalog = JSON.parse(fs.readFileSync('/tmp/standalone/catalog.json', 'utf8')).data;
    const file = catalog.find((item) => item.uuid === uuid);
    return {
        status: file ? 200 : 404,
        datum: file ?? null,
        error: file ? null : `Failed to read item ${uuid} in /tmp/standalone/catalog.json `
    };
};

export const updateFileInCatalog = async (uuid: string, itemToUpdate: FileProps): Promise<ICatalogResponse> => {
    const catalog = JSON.parse(fs.readFileSync('/tmp/standalone/catalog.json', 'utf8')).data;
    const updatedCatalog = catalog.map((catalogItem) => {
        if (catalogItem.uuid === uuid) {
            return { ...catalogItem, ...itemToUpdate };
        }
        return catalogItem;
    });
    fs.writeFileSync('/tmp/standalone/catalog.json', JSON.stringify({ data: updatedCatalog }));
    return { status: 200, datum: itemToUpdate, error: null };
};

export const updateFilesInCatalog = async (items: FileProps[]): Promise<ICatalogResponseMulti> => {
    const catalog = JSON.parse(fs.readFileSync('/tmp/standalone/catalog.json', 'utf8')).data;

    const updatedItems = catalog.map((catalogItem) => {
        const itemToUpdate = items.find((item) => item.uuid === catalogItem.uuid);
        return itemToUpdate ? { ...catalogItem, ...itemToUpdate } : catalogItem;
    });

    fs.writeFileSync('/tmp/standalone/catalog.json', JSON.stringify({ data: updatedItems }));
    return { status: 200, data: items, errors: null };
};

export const deleteFileFromCatalog = async (uuid: string): Promise<ICatalogResponse> => {
    const catalog = JSON.parse(fs.readFileSync('/tmp/standalone/catalog.json', 'utf8')).data;
    const itemToDelete = catalog.find((catalogItem) => catalogItem.uuid === uuid);
    const updatedCatalog = catalog.filter((catalogItem) => catalogItem.uuid !== uuid);
    fs.writeFileSync('/tmp/standalone/catalog.json', JSON.stringify({ data: updatedCatalog }));
    return { status: 200, datum: { ...itemToDelete, message: 'Item deleted' }, error: null };
};

export const deleteFilesInCatalog = async (items: FileProps[]): Promise<ICatalogResponseMulti> => {
    try {
        const catalog = JSON.parse(fs.readFileSync('/tmp/standalone/catalog.json', 'utf8')).data;
        const updatedItems = catalog.filter((catalogItem) => !items.some((item) => item.uuid === catalogItem.uuid));

        fs.writeFileSync('/tmp/standalone/catalog.json', JSON.stringify({ data: updatedItems }));

        return { status: 200, data: items, errors: null };
    } catch (error) {
        return { status: 500, data: [], errors: error };
    }
};

export const deleteCatalog = async (): Promise<ICatalogResponseMulti> => {
    try {
        fs.writeFileSync('/tmp/standalone/catalog.json', JSON.stringify({ data: [] }));
        return { status: 200, data: [], errors: null };
    } catch (err) {
        return { status: 400, data: null, errors: [`Error deleting catalog : ${err}`] };
    }
};

export const getDump = async (): Promise<{ status: number; data: string[]; errors: string[] }> => {
    return { status: 200, data: ['Dump created successfully'], errors: null };
};

export const createDump = async (): Promise<{ status: number; data: string[]; errors: string[] }> => {
    return { status: 200, data: ['Dump created successfully'], errors: null };
};

export const restoreDump = async (): Promise<{ status: number; data: string[]; errors: string[] }> => {
    return { status: 200, data: ['Dump created successfully'], errors: null };
};
