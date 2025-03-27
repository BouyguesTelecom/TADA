import { ICatalogResponse, ICatalogResponseMulti } from '../interfaces/Icatalog';
import { IFile } from '../interfaces/Ifile';
import { File } from './file.model';

export class ApiResponse {
    // success for one file
    static createSuccessResponse(file: File | IFile, status: number = 200): ICatalogResponse {
        const fileInstance = file instanceof File ? file : new File(file);

        return {
            status,
            datum: fileInstance.toJSON(),
            error: null
        };
    }

    // success for multiple files
    static createMultiSuccessResponse(files: Array<File | IFile>, status: number = 200, message?: string | null): ICatalogResponseMulti {
        const fileInstances = files.map((file) => (file instanceof File ? file : new File(file)));

        return {
            status,
            data: fileInstances.map((f) => f.toJSON()),
            message: message || null,
            errors: null
        };
    }

    // empty success response for multiple files
    static createEmptyMultiSuccessResponse(status: number = 200, message?: string | null): ICatalogResponseMulti {
        return {
            status,
            data: [],
            message: message || null,
            errors: null
        };
    }

    // error for 1 file
    static createErrorResponse(error: string, status: number = 500): ICatalogResponse {
        return {
            status,
            datum: null,
            error
        };
    }

    // validation error for 1 file
    static createValidationErrorResponse(validationError: string): ICatalogResponse {
        return {
            status: 400,
            datum: null,
            error: validationError
        };
    }

    // error for multiple files
    static createMultiErrorResponse(errors: string[], status: number = 500, message?: string | null): ICatalogResponseMulti {
        return {
            status,
            data: null,
            message: message || null,
            errors
        };
    }

    // validation error for multiple files
    static createMultiValidationErrorResponse(validationErrors: string[]): ICatalogResponseMulti {
        return {
            status: 400,
            data: null,
            errors: validationErrors
        };
    }

    // error not found
    static createNotFoundResponse(message: string = 'File not found'): ICatalogResponse {
        return {
            status: 404,
            datum: null,
            error: message
        };
    }

    // create partial success response for mixed results
    static createPartialSuccessResponse(files: Array<File | IFile>, errors: string[], message?: string | null): ICatalogResponseMulti {
        const fileInstances = files.map((file) => (file instanceof File ? file : new File(file)));

        return {
            status: 207,
            data: fileInstances.map((f) => f.toJSON()),
            message: message || null,
            errors
        };
    }
}
