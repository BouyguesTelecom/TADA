import { ReadStream } from 'node:fs';

export interface FileProps {
    filename: string;
    file: string | ReadStream;
}
