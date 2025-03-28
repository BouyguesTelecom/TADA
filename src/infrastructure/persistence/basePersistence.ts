import { ICatalogRepository, ICatalogResponse, ICatalogResponseMulti } from '../../core/interfaces/Icatalog';
import { IFile } from '../../core/interfaces/Ifile';
import { ApiResponse } from '../../core/models/response.model';
import { validateFileBeforeUpdate, validateFiles } from './validators/file.validator';

export abstract class BasePersistence implements ICatalogRepository {
    protected storageType = 'BASE';

    abstract find(id: string): Promise<IFile | null>;
    abstract findAll(): Promise<IFile[]>;
    abstract save(file: IFile): Promise<IFile>;
    abstract delete(id: string): Promise<void>;
    abstract createDump(): Promise<{ status: number; data: string[]; errors: string[] }>;
    abstract addMany(files: IFile[]): Promise<ICatalogResponseMulti>;
    abstract deleteAll(): Promise<ICatalogResponseMulti>;
    abstract getByUuid(uuid: string): Promise<ICatalogResponse>;
    abstract add(file: IFile): Promise<ICatalogResponse>;
    abstract update(uuid: string, fileData: Partial<IFile>): Promise<ICatalogResponse>;

    protected createErrorResponse(message: string, status: number = 500): ICatalogResponse {
        return ApiResponse.errorWithDatum(message, status);
    }

    protected createValidationErrorResponse(validationErrors: string): ICatalogResponse {
        return ApiResponse.validationError(validationErrors);
    }

    protected createMultiErrorResponse(errors: string[], status: number = 500): ICatalogResponseMulti {
        return ApiResponse.errorMulti('Failed to get catalog', errors);
    }

    protected createMultiValidationErrorResponse(validationErrors: string[]): ICatalogResponseMulti {
        return ApiResponse.errorMulti('Failed to get catalog', validationErrors);
    }

    protected createMultiSuccessResponse(files: IFile[]): ICatalogResponseMulti {
        return ApiResponse.successMulti(files);
    }

    protected validateFilesBeforeAdd(files: IFile[]): string[] | null {
        const validationErrors = validateFiles(files);
        if (!validationErrors) return null;
        return validationErrors.map((error) => `${error.path.join('.')}: ${error.message}`);
    }

    protected validateFileBeforeUpdate(fileData: Partial<IFile>): string | null {
        return validateFileBeforeUpdate(fileData);
    }

    protected async validateFileExists(uuid: string): Promise<boolean> {
        const file = await this.find(uuid);
        return file !== null;
    }

    protected async validateUniqueName(uniqueName: string, excludeUuid?: string): Promise<boolean> {
        const files = await this.findAll();
        return !files.some((file) => file.unique_name === uniqueName && (!excludeUuid || file.uuid !== excludeUuid));
    }
}
