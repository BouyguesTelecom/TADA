import { IFile } from './Ifile';

export interface IStorageResponse {
    success: boolean;
    file?: IFile;
    error?: string;
}

export interface IStorage {
    uploadFile(fileBuffer: Buffer, metadata: Partial<IFile>): Promise<IStorageResponse>;
    getFile(identifier: string): Promise<Buffer | null>;
    deleteFile(identifier: string): Promise<boolean>;
    getPublicUrl(identifier: string): string | null;
}
