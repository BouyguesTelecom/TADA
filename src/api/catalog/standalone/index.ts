import fs from 'fs';
import { FileProps, ICatalogResponse, ICatalogResponseMulti } from '../../props/catalog';
import { getCurrentDateVersion } from '../../utils/catalog';

const CATALOG_PATH = '/tmp/standalone/catalog.json';

const ensureCatalogExists = () => {
    try {
        const dir = '/tmp/standalone';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (!fs.existsSync(CATALOG_PATH)) {
            fs.writeFileSync(CATALOG_PATH, JSON.stringify({ data: [] }));
        }
    } catch (error) {
        console.error('Error ensuring catalog exists:', error);
    }
};

const readCatalog = () => {
    ensureCatalogExists();
    return JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
};

export const addFileInCatalog = async (item: FileProps): Promise<ICatalogResponse> => {
    const catalog = readCatalog().data;
    fs.writeFileSync(CATALOG_PATH, JSON.stringify({ data: [...catalog, item] }));
    return {
        status: 200,
        datum: item,
        error: null
    };
};

export const addFilesInCatalog = async (items: FileProps[]): Promise<ICatalogResponseMulti> => {
    const catalog = readCatalog().data;
    fs.writeFileSync(CATALOG_PATH, JSON.stringify({ data: [...catalog, ...items] }));
    return {
        status: 200,
        data: items,
        errors: []
    };
};

export const getFiles = async (): Promise<ICatalogResponseMulti> => {
    const catalog = readCatalog();
    if (catalog) {
        return { status: 200, data: catalog.data, errors: [] };
    }
    return { status: 400, errors: ['Failed to read catalog /tmp/standalone/catalog.json'], data: null };
};

export const getFile = async (uuid): Promise<ICatalogResponse> => {
    const catalog = readCatalog().data;
    const file = catalog.find((item) => item.uuid === uuid);
    return {
        status: file ? 200 : 404,
        datum: file ?? null,
        error: file ? null : `Failed to read item ${uuid} in /tmp/standalone/catalog.json `
    };
};

export const updateFileInCatalog = async (uuid: string, itemToUpdate: FileProps): Promise<ICatalogResponse> => {
    const catalog = readCatalog().data;
    let updatedItem = null;
    const updatedCatalog = catalog.map((catalogItem) => {
        if (catalogItem.uuid === uuid) {
            updatedItem = { ...catalogItem, ...itemToUpdate };
            return updatedItem;
        }
        return catalogItem;
    });
    fs.writeFileSync(CATALOG_PATH, JSON.stringify({ data: updatedCatalog }));
    return { status: 200, datum: updatedItem, error: null };
};

export const deleteFileFromCatalog = async (uuid: string): Promise<ICatalogResponse> => {
    const catalog = readCatalog().data;
    const itemToDelete = catalog.find((catalogItem) => catalogItem.uuid === uuid);
    const updatedCatalog = catalog.filter((catalogItem) => catalogItem.uuid !== uuid);
    fs.writeFileSync(CATALOG_PATH, JSON.stringify({ data: updatedCatalog }));
    return { status: 200, datum: { ...itemToDelete, message: 'Item deleted' }, error: null };
};

export const deleteCatalog = async (): Promise<ICatalogResponseMulti> => {
    try {
        fs.writeFileSync(CATALOG_PATH, JSON.stringify({ data: [] }));
        return { status: 200, data: [], errors: [] };
    } catch (err) {
        return { status: 400, data: null, errors: [`Error deleting catalog : ${err}`] };
    }
};

export const getDump = async (filename = null, format = 'json'): Promise<{ status: number; data: string[]; errors: string[]; filename?: string }> => {
    try {
        const dumpsDir = '/tmp/standalone/dumps';
        if (!fs.existsSync(dumpsDir)) {
            fs.mkdirSync(dumpsDir, { recursive: true });
        }

        if (format === 'rdb') {
            return {
                status: 400,
                data: [],
                errors: ['RDB dumps not supported in STANDALONE mode - no Redis available. Use JSON format.']
            };
        }

        if (filename) {
            const dumpPath = `${dumpsDir}/${filename}`;
            
            if (!fs.existsSync(dumpPath)) {
                return {
                    status: 404,
                    data: [],
                    errors: [`Dump file not found: ${filename}`]
                };
            }

            const dumpText = fs.readFileSync(dumpPath, 'utf-8');
            return {
                status: 200,
                data: [dumpText],
                errors: [],
                filename: filename
            };
        } else {
            const files = fs.readdirSync(dumpsDir);
            const dumpFiles = files.filter(file => file.endsWith('.json')).sort().reverse();
            
            if (dumpFiles.length === 0) {
                return {
                    status: 404,
                    data: [],
                    errors: [`No JSON dump files found`]
                };
            }

            const latestDump = dumpFiles[0];
            const dumpPath = `${dumpsDir}/${latestDump}`;
            
            const dumpText = fs.readFileSync(dumpPath, 'utf-8');
            return {
                status: 200,
                data: [dumpText],
                errors: [],
                filename: latestDump
            };
        }
    } catch (error) {
        return {
            status: 500,
            data: [],
            errors: [`Error getting dump: ${error.message}`]
        };
    }
};

export const createDump = async (filename = null, format = 'json'): Promise<{ status: number; data: string[]; errors: string[] }> => {
    try {
        const dumpsDir = '/tmp/standalone/dumps';

        if (!fs.existsSync(dumpsDir)) {
            fs.mkdirSync(dumpsDir, { recursive: true });
        }

        if (format === 'rdb') {
            return {
                status: 400,
                data: [],
                errors: ['RDB dumps not supported in STANDALONE mode - no Redis available. Use JSON format.']
            };
        }

        const timestamp = getCurrentDateVersion();

        const catalog = readCatalog();
        if (!catalog || !catalog.data) {
            return {
                status: 400,
                data: [],
                errors: ['No catalog data to dump']
            };
        }

        const dumpContent = JSON.stringify(catalog.data, null, 2);
        const dumpPath = filename ? `${dumpsDir}/${filename}.json` : `${dumpsDir}/dump_${timestamp}.json`;

        fs.writeFileSync(dumpPath, dumpContent);

        return {
            status: 200,
            data: [`Successfully created JSON dump: ${dumpPath}`],
            errors: []
        };
    } catch (error) {
        return {
            status: 500,
            data: [],
            errors: [`Error creating dump: ${error.message}`]
        };
    }
};

export const restoreDump = async (filename = null, format = 'json'): Promise<{ status: number; data: string[]; errors: string[] }> => {
    try {
        if (format === 'rdb') {
            return {
                status: 400,
                data: [],
                errors: ['RDB dumps not supported in STANDALONE mode - no Redis available. Use JSON format.']
            };
        }

        const dumpResult = await getDump(filename, format);
        
        if (dumpResult.status !== 200) {
            return dumpResult;
        }

        const catalogData = JSON.parse(dumpResult.data[0]);

        if (!Array.isArray(catalogData)) {
            return {
                status: 400,
                data: [],
                errors: ['Invalid dump format - expected array of catalog items']
            };
        }

        fs.writeFileSync(CATALOG_PATH, JSON.stringify({ data: catalogData }));

        return {
            status: 200,
            data: [`Successfully restored ${catalogData.length} items from JSON dump: ${(dumpResult as any).filename || filename}`],
            errors: []
        };
    } catch (error) {
        return {
            status: 500,
            data: [],
            errors: [`Error restoring dump: ${error.message}`]
        };
    }
};