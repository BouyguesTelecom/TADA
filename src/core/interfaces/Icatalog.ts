import { IFile } from './Ifile';

export interface IApiResponse<T> {
    status: number;
    data: T | null;
    error: string | null;
    message?: string;
}

export interface ICatalogResponse {
    status: number;
    datum: IFile | null;
    error: string | null;
}

export interface ICatalogResponseMulti {
    status: number;
    data: IFile[] | null;
    errors: string[] | null;
}

export interface ICatalogRepository {
    find(id: string): Promise<IFile | null>;
    findAll(): Promise<IFile[]>;
    save(file: IFile): Promise<IFile>;
    delete(id: string): Promise<void>;
    createDump(): Promise<{ status: number; data: string[]; errors: string[] }>;
    addMany(files: IFile[]): Promise<ICatalogResponseMulti>;
    deleteAll(): Promise<ICatalogResponseMulti>;
    getByUuid(uuid: string): Promise<ICatalogResponse>;
    add(file: IFile): Promise<ICatalogResponse>;
    update(uuid: string, fileData: Partial<IFile>): Promise<ICatalogResponse>;
}

export interface ICatalogService {
    getFile(uuid: string): Promise<ICatalogResponse>;
    getFiles(): Promise<ICatalogResponseMulti>;
    addFile(file: IFile): Promise<ICatalogResponse>;
    updateFile(uuid: string, file: Partial<IFile>): Promise<ICatalogResponse>;
    deleteFile(uuid: string): Promise<ICatalogResponse>;
    createDump(): Promise<{ status: number; data: string[]; errors: string[] }>;
    addFiles(files: IFile[]): Promise<ICatalogResponseMulti>;
    deleteAllFiles(): Promise<ICatalogResponseMulti>;
}
