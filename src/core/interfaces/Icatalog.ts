import { IFile } from './Ifile';

export interface ICatalogResponse {
    status?: number;
    datum: IFile | null;
    error: string | null;
}

export interface ICatalogResponseMulti {
    status: number;
    data: IFile[] | null;
    errors: string[] | null;
}

export interface ICatalogService {
    getFile({ uuid }: { uuid: string }): Promise<ICatalogResponse>;
    getFiles(): Promise<ICatalogResponseMulti>;
    addFile(file: IFile): Promise<ICatalogResponse>;
    updateFile(uuid: string, file: Partial<IFile>): Promise<ICatalogResponse>;
    deleteFile(uniqueName: string): Promise<ICatalogResponse>;
    createDump(): Promise<{ status: number; data: string[]; errors: string[] }>;
    addFiles(files: IFile[]): Promise<ICatalogResponseMulti>;
    deleteAllFiles(): Promise<ICatalogResponseMulti>;
}

export interface ICatalogRepository {
    getAll(): Promise<ICatalogResponseMulti>;
    getByUuid(uuid: string): Promise<ICatalogResponse>;
    add(file: IFile): Promise<ICatalogResponse>;
    addMany(files: IFile[]): Promise<ICatalogResponseMulti>;
    update(uuid: string, fileData: Partial<IFile>): Promise<ICatalogResponse>;
    delete(uuid: string): Promise<ICatalogResponse>;
    deleteAll(): Promise<ICatalogResponseMulti>;
    createDump(): Promise<ICatalogResponseMulti>;
}
