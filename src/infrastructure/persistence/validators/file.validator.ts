import * as Joi from 'joi';
import { IFile } from '../../../core/interfaces/Ifile';

export const fileSchema = Joi.object({
    uuid: Joi.string().required(),
    filename: Joi.string().required(),
    namespace: Joi.string().required(),
    unique_name: Joi.string().required(),
    expiration_date: Joi.string().allow(null).optional(),
    expired: Joi.boolean().optional().default(false),
    external_id: Joi.string().allow(null).optional(),
    version: Joi.number().required().default(1),
    public_url: Joi.string().optional(),
    original_filename: Joi.string().optional(),
    base_url: Joi.string().optional(),
    information: Joi.string().allow(null).optional(),
    destination: Joi.string().allow(null).optional(),
    original_mimetype: Joi.string().optional(),
    mimetype: Joi.string().optional(),
    signature: Joi.string().optional(),
    size: Joi.alternatives().try(Joi.string(), Joi.number()).optional()
});

export interface ValidationErrorDetail {
    message: string;
    path: (string | number)[];
    type: string;
    context?: {
        key?: string;
        label?: string;
        [key: string]: any;
    };
}

export const validateFile = (file: unknown): ValidationErrorDetail[] | null => {
    const { error } = fileSchema.validate(file, { abortEarly: false });
    return error ? error.details : null;
};

export const validateFiles = (files: unknown[]): ValidationErrorDetail[] | null => {
    if (!Array.isArray(files)) {
        return [
            {
                message: 'Input must be an array of files',
                path: ['files'],
                type: 'validation.array'
            }
        ];
    }

    let allErrors: ValidationErrorDetail[] = [];

    files.forEach((file, index) => {
        const fileErrors = validateFile(file);
        if (fileErrors) {
            const indexedErrors = fileErrors.map((error) => ({
                ...error,
                path: [index, ...error.path]
            }));
            allErrors = [...allErrors, ...indexedErrors];
        }
    });

    return allErrors.length > 0 ? allErrors : null;
};

// Check if file with given UUID already exists
export const isUuidUnique = (files: IFile[], uuid: string): boolean => {
    return !files.some((file) => file.uuid === uuid);
};

// Check if file with given unique_name already exists
export const isUniqueNameUnique = (files: IFile[], uniqueName: string): boolean => {
    return !files.some((file) => file.unique_name === uniqueName);
};

export const validateFileForAdd = (file: unknown, existingFiles: IFile[]): ValidationErrorDetail[] | null => {
    const formatErrors = validateFile(file);
    if (formatErrors) {
        return formatErrors;
    }

    const typedFile = file as IFile;
    if (typedFile.uuid && !isUuidUnique(existingFiles, typedFile.uuid)) {
        return [
            {
                message: `File with UUID ${typedFile.uuid} already exists`,
                path: ['uuid'],
                type: 'unique.constraint'
            }
        ];
    }

    if (typedFile.unique_name && !isUniqueNameUnique(existingFiles, typedFile.unique_name)) {
        return [
            {
                message: `File with unique_name ${typedFile.unique_name} already exists`,
                path: ['unique_name'],
                type: 'unique.constraint'
            }
        ];
    }

    return null;
};
