export interface StorageFileProps {
    filepath: string;
    file?: Buffer;
    metadata?: {
        unique_name?: string;
        base_url?: string;
        destination?: string;
        filename?: string;
        mimetype?: string;
        size?: number;
        namespace?: string;
        version?: number;
        [key: string]: any;
    };
}

export interface StorageFilesProps {
    files: StorageFileProps[];
}

export interface StorageResponse {
    status: number;
    data: any;
    message: string;
    results?: {
        success?: string[];
        errors?: string[];
        [key: string]: any;
    };
}

export interface IStorageService {
    getFile(props: StorageFileProps): Promise<StorageResponse>;
    upload(props: StorageFileProps): Promise<StorageResponse>;
    uploads(props: StorageFilesProps): Promise<StorageResponse>;
    update(props: StorageFileProps): Promise<StorageResponse>;
    updates(props: StorageFilesProps): Promise<StorageResponse>;
    delete(props: StorageFileProps): Promise<StorageResponse>;
    deleteFiles(props: StorageFilesProps): Promise<StorageResponse>;
    getLastDump(): Promise<StorageResponse>;
}

export abstract class BaseStorage implements IStorageService {
    protected storageType: string;

    constructor(storageType: string) {
        this.storageType = storageType;
    }

    abstract getFile(props: StorageFileProps): Promise<StorageResponse>;
    abstract upload(props: StorageFileProps): Promise<StorageResponse>;
    abstract uploads(props: StorageFilesProps): Promise<StorageResponse>;
    abstract update(props: StorageFileProps): Promise<StorageResponse>;
    abstract updates(props: StorageFilesProps): Promise<StorageResponse>;
    abstract delete(props: StorageFileProps): Promise<StorageResponse>;
    abstract deleteFiles(props: StorageFilesProps): Promise<StorageResponse>;
    abstract getLastDump(): Promise<StorageResponse>;

    protected createSuccessResponse(data: any, message?: string): StorageResponse {
        return {
            status: 200,
            data,
            message: message || 'Operation successful'
        };
    }

    protected createErrorResponse(status: number, message: string): StorageResponse {
        return {
            status,
            data: null,
            message
        };
    }

    protected createNotFoundResponse(filepath: string): StorageResponse {
        return {
            status: 404,
            data: null,
            message: `File not found: ${filepath}`
        };
    }
}
