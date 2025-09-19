import { Readable } from 'stream';

export interface BackupProps {
    status: number;
    message?: string;
    stream?: Readable;
    error?: string;
}

export interface BackupMultiProps {
    status: number;
    data?: string[];
    errors?: string[];
}
