import { FileProps } from './catalog';

export interface FileControllerLocals {
    uniqueName: string;
    file: FileProps;
    queryVersion?: string;
}

