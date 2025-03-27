import * as Joi from 'joi';
import { IFile } from '../../../core/interfaces/Ifile';

const fileSchema = Joi.object({
    filename: Joi.string().required(),
    namespace: Joi.string().required(),
    expiration_date: Joi.date().allow(null).optional(),
    expired: Joi.boolean().optional(),
    external_id: Joi.string().allow(null).optional(),
    uuid: Joi.string().required(),
    unique_name: Joi.string().required(),
    version: Joi.number().required(),
    public_url: Joi.string().optional(),
    original_filename: Joi.string().optional(),
    base_url: Joi.string().optional(),
    base_host: Joi.string().optional(),
    information: Joi.string().allow(null).optional(),
    destination: Joi.string().allow(null).optional(),
    original_mimetype: Joi.string().optional(),
    mimetype: Joi.string().optional(),
    signature: Joi.string().required(),
    size: Joi.number().allow(null).optional(),
    toWebp: Joi.boolean().optional()
}).unknown(true);

export function validateFileForAdd(file: IFile, existingFiles: IFile[] = []): string | null {
    const { error } = fileSchema.validate(file, { abortEarly: false });

    if (error) {
        const errorMessages = error.details.map((detail) => `${detail.path.join('.')}: ${detail.message}`).join(', ');

        return `Validation error: ${errorMessages}`;
    }

    return null;
}

export function validateFiles(files: IFile[]): Joi.ValidationErrorItem[] | null {
    const filesArraySchema = Joi.array().items(fileSchema);
    const { error } = filesArraySchema.validate(files, { abortEarly: false });

    return error ? error.details : null;
}

export function validateFileBeforeUpdate(fileData: Partial<IFile>): string | null {
    const updateSchema = Joi.object({
        filename: Joi.string().optional(),
        namespace: Joi.string().optional(),
        expiration_date: Joi.date().allow(null).optional(),
        expired: Joi.boolean().optional(),
        external_id: Joi.string().allow(null).optional(),
        uuid: Joi.string().optional(),
        unique_name: Joi.string().optional(),
        version: Joi.number().optional(),
        public_url: Joi.string().optional(),
        original_filename: Joi.string().optional(),
        base_url: Joi.string().optional(),
        base_host: Joi.string().optional(),
        information: Joi.string().allow(null).optional(),
        destination: Joi.string().allow(null).optional(),
        original_mimetype: Joi.string().optional(),
        mimetype: Joi.string().optional(),
        signature: Joi.string().optional(),
        size: Joi.number().allow(null).optional(),
        toWebp: Joi.boolean().optional()
    }).unknown(true);

    const { error } = updateSchema.validate(fileData, { abortEarly: false });

    if (error) {
        const errorMessages = error.details.map((detail) => `${detail.path.join('.')}: ${detail.message}`).join(', ');

        return `Validation error: ${errorMessages}`;
    }

    return null;
}
