import * as nodeFetch from 'node-fetch';
import * as pathLib from 'path';

interface FetchProps {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: HeadersInit;
    body?: string;
}

interface FetchResponseProps {
    status: number;
    data: any | null;
    errors: any | null;
}

export const fetch = async ({ url, method = 'GET', headers = {}, body = null }: FetchProps): Promise<FetchResponseProps> => {
    let config = { method, headers, redirect: 'follow' };
    try {
        const response = await nodeFetch(url, body ? { ...config, body } : config);
        if (response.ok) {
            return { status: response.status, data: response, errors: null };
        }
        return {
            status: response.status,
            data: null,
            errors: await response.text()
        };
    } catch (err) {
        return { status: 500, data: null, errors: err };
    }
};

interface GenerateURLProps {
    host: string;
    path: string;
}

export const generateURL = ({ host, path }: GenerateURLProps) => {
    if (process.env.DEV_ENV) {
        return pathLib.join(host, '/DEV', path);
    }
    return pathLib.join(host, path);
};
