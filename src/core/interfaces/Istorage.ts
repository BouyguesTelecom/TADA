import { IFile } from './Ifile';

export interface IStorageResponse {
    success: boolean;
    file?: IFile;
    error?: string;
    data?: any;
    message?: string;
    results?: {
        success?: string[];
        errors?: string[];
        [key: string]: any;
    };
}

export interface IStorage {
    uploadFile(fileBuffer: Buffer, metadata: Partial<IFile>): Promise<IStorageResponse>;
    getFile(identifier: string): Promise<IStorageResponse>;
    deleteFile(identifier: string): Promise<IStorageResponse>;
    getPublicUrl(identifier: string): string | null;
    getLastDump(): Promise<IStorageResponse>;
    uploads(files: Array<{ filepath: string; file?: Buffer; metadata?: Partial<IFile> }>): Promise<IStorageResponse>;
    deleteFiles(files: Array<{ filepath: string }>): Promise<IStorageResponse>;
}
