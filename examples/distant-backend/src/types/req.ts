// ReqProps extends Request express and add metadata to it

import { Request } from 'express';

export interface ReqProps extends Request {
    metadata?: {
        currentFile?: {
            dir: string;
            name: string;
        }
        files?: string[];
    };
}
