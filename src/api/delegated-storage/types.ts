
export interface FileProps {
    filepath: string;
    version?: string;
    mimetype?: string;
    headers?: Record<string, string>;
    original?: boolean
}

export interface ResponseBackup {
    status: number;
    body?: any;
    json?: any;
}
