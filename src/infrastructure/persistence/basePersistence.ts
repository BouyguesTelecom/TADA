import { ICatalogRepository, ICatalogResponse, ICatalogResponseMulti } from '../../core/interfaces/Icatalog';
import { IFile } from '../../core/interfaces/Ifile';
import { ApiResponse } from '../../core/models/response.model';

export abstract class BasePersistence implements ICatalogRepository {
    protected storageType = 'BASE';

    abstract getAll(): Promise<ICatalogResponseMulti>;
    abstract getByUuid(uuid: string): Promise<ICatalogResponse>;
    abstract add(file: IFile): Promise<ICatalogResponse>;
    abstract addMany(files: IFile[]): Promise<ICatalogResponseMulti>;
    abstract update(uuid: string, fileData: Partial<IFile>): Promise<ICatalogResponse>;
    abstract delete(uuid: string): Promise<ICatalogResponse>;
    abstract deleteAll(): Promise<ICatalogResponseMulti>;
    abstract createDump(): Promise<ICatalogResponseMulti>;

    protected createErrorResponse(message: string, status: number = 500): ICatalogResponse {
        return ApiResponse.createErrorResponse(message, status);
    }

    protected createValidationErrorResponse(validationErrors: string): ICatalogResponse {
        return ApiResponse.createValidationErrorResponse(validationErrors);
    }

    protected createMultiErrorResponse(errors: string[], status: number = 500): ICatalogResponseMulti {
        return ApiResponse.createMultiErrorResponse(errors, status);
    }

    protected createMultiValidationErrorResponse(validationErrors: string[]): ICatalogResponseMulti {
        return ApiResponse.createMultiValidationErrorResponse(validationErrors);
    }

    protected createMultiSuccessResponse(files: IFile[], status: number = 200): ICatalogResponseMulti {
        return ApiResponse.createMultiSuccessResponse(files, status);
    }

    protected validateFilesBeforeAdd(files: IFile[]): string[] | null {
        return null;
    }

    protected validateFileBeforeUpdate(fileData: Partial<IFile>): string | null {
        return null;
    }
}
