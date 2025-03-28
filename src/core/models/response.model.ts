import { ICatalogResponse, ICatalogResponseMulti } from '../interfaces/Icatalog';
import { IFile } from '../interfaces/Ifile';

export class ApiResponse {
    static success<T>(data: T, status = 200, message?: string): { status: number; data: T; error: null; message?: string } {
        return { status, data, error: null, message };
    }

    static error(message: string, status = 500): { status: number; data: null; error: string } {
        return { status, data: null, error: message };
    }

    static notFound(message = 'File not found'): ICatalogResponse {
        return { status: 404, datum: null, error: message };
    }

    static validationError(message: string): ICatalogResponse {
        return { status: 400, datum: null, error: message };
    }

    static createErrorResponse(message: string, status: number = 500): ICatalogResponse {
        return { status, datum: null, error: message };
    }

    static successWithDatum(data: IFile, status = 200): ICatalogResponse {
        return { status, datum: data, error: null };
    }

    static errorWithDatum(message: string, status = 500): ICatalogResponse {
        return { status, datum: null, error: message };
    }

    static successMulti(data: IFile[]): ICatalogResponseMulti {
        return { status: 200, data, errors: null };
    }

    static errorMulti(message: string, errors: string[]): ICatalogResponseMulti {
        return { status: 500, data: null, errors };
    }
}
