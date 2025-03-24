import { Response } from 'express';

export interface ResponseProps {
    res?: Response;
}

export interface MissingParamsProps extends ResponseProps {
    requiredParams: string[];
    params: Object;
    errors?: Object[];
}

export interface NamespaceProps extends ResponseProps {
    namespace: string;
    errors?: Object[];
}
