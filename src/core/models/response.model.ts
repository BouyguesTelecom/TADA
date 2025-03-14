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

    // succes for multiple files
    static createMultiSuccessResponse(files: Array<File | IFile>, status: number = 200): ICatalogResponseMulti {
        const fileInstances = files.map((file) => (file instanceof File ? file : new File(file)));

        return {
            status,
            data: fileInstances.map((f) => f.toJSON()),
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

    // error for mulitple files
    static createMultiErrorResponse(errors: string[], status: number = 500): ICatalogResponseMulti {
        return {
            status,
            data: null,
            errors
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
}
