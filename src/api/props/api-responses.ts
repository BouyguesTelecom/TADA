import { Readable } from 'node:stream';

export interface GetAssetResult {
    status: number;
    stream?: Readable;
    contentType?: string;
    contentDisposition?: string;
    buffer?: Buffer;
    error?: string;
}

export interface PostAssetResult {
    status: number;
    data?: any;
    errors?: string[];
    purge?: string;
}

export interface PatchAssetResult {
    status: number;
    data?: any[];
    errors?: string[];
    purge?: string;
}

export interface DeleteAssetResult {
    status: number;
    data?: any[];
    errors?: string[];
    purge?: string;
}