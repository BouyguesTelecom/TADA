
export interface FileProps {
    filepath: string;
    version?: string;
    mimetype?: string;
    headers?: Record<string, string>;
}

export interface ResponseBackup {
    status: number;
    body?: any;
    json?: any;
}
