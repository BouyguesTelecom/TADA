import { ICatalogRepository, ICatalogResponse, ICatalogResponseMulti } from '../../core/interfaces/Icatalog';
import { IFile } from '../../core/interfaces/Ifile';
import { ValidationErrorDetail, validateFile, validateFiles } from './validators/file.validator';

export abstract class BasePersistence implements ICatalogRepository {
    protected abstract storageType: string;

    abstract getAll(): Promise<ICatalogResponseMulti>;
    abstract getByUuid(uuid: string): Promise<ICatalogResponse>;
    abstract add(file: IFile): Promise<ICatalogResponse>;
    abstract addMany(files: IFile[]): Promise<ICatalogResponseMulti>;
    abstract update(uuid: string, fileData: Partial<IFile>): Promise<ICatalogResponse>;
    abstract delete(uuid: string): Promise<ICatalogResponse>;
    abstract deleteAll(): Promise<ICatalogResponseMulti>;
    abstract createDump(): Promise<ICatalogResponseMulti>;

    // Validation helpers
    protected validateFileBeforeAdd(file: unknown): ValidationErrorDetail[] | null {
        return validateFile(file);
    }

    protected validateFilesBeforeAdd(files: unknown[]): ValidationErrorDetail[] | null {
        return validateFiles(files);
    }

    protected validateFileBeforeUpdate(fileData: Partial<IFile>): ValidationErrorDetail[] | null {
        // For updates, only validate fields that are present
        if (Object.keys(fileData).length === 0) {
            return [
                {
                    message: 'No fields to update',
                    path: [],
                    type: 'update.empty'
                }
            ];
        }
        return null;
    }

    protected createSuccessResponse(file: IFile, status: number = 200): ICatalogResponse {
        return {
            status,
            datum: file,
            error: null
        };
    }

    protected createErrorResponse(error: string, status: number = 500): ICatalogResponse {
        return {
            status,
            datum: null,
            error
        };
    }

    protected createValidationErrorResponse(errors: ValidationErrorDetail[]): ICatalogResponse {
        const errorMessages = errors.map((error) => `${error.path.join('.')}: ${error.message}`).join(', ');
        return {
            status: 400,
            datum: null,
            error: `Validation error: ${errorMessages}`
        };
    }

    protected createMultiSuccessResponse(files: IFile[], status: number = 200): ICatalogResponseMulti {
        return {
            status,
            data: files,
            errors: null
        };
    }

    protected createMultiErrorResponse(errors: string[], status: number = 500): ICatalogResponseMulti {
        return {
            status,
            data: null,
            errors
        };
    }

    protected createMultiValidationErrorResponse(errors: ValidationErrorDetail[]): ICatalogResponseMulti {
        const errorMessages = errors.map((error) => `${error.path.join('.')}: ${error.message}`);
        return {
            status: 400,
            data: null,
            errors: errorMessages
        };
    }
}
