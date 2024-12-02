import { Readable } from 'stream';

export interface BackupProps {
    status: number;
    message?: string;
    stream?: Readable;
}
