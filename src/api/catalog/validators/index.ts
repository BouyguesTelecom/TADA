import * as Joi from 'joi';
import { FileProps } from '../../props/catalog';
import { logger } from '../../utils/logs/winston';
import { getCatalog } from '../index';

const fileSchema = Joi.object({
    filename: Joi.string().required(),
    namespace: Joi.string().required(),
    expiration_date: Joi.date().allow(null).optional(),
    expired: Joi.boolean().optional(),
    external_id: Joi.string().allow(null).optional(),
    uuid: Joi.string().required(),
    unique_name: Joi.string().required(),
    version: Joi.number().required(),
    public_url: Joi.string().required(),
    original_filename: Joi.string().required(),
    base_url: Joi.string().required(),
    base_host: Joi.string().required(),
    information: Joi.string().allow(null).optional(),
    destination: Joi.string().optional(),
    original_mimetype: Joi.string().optional(),
    mimetype: Joi.string().optional(),
    signature: Joi.string().required(),
    size: Joi.number().required()
});

interface ValidateSchemaProps {
    schema: Joi.ObjectSchema | Joi.ArraySchema;
    body: unknown;
}

interface ValidationErrorDetail {
    message: string;
    path: (string | number)[];
    type: string;
    context?: {
        key?: string;
        label?: string;
        [key: string]: any;
    };
}

const validateSchema = ({ schema, body }: ValidateSchemaProps) => {
    return schema.validate(body, { abortEarly: false });
};

export const validateOneFile = (body: unknown): ValidationErrorDetail[] | null => {
    const { error } = validateSchema({ schema: fileSchema, body });
    return error ? error.details : null;
};

export const validateMultipleFile = (body: unknown): ValidationErrorDetail[] | null => {
    const filesArraySchema = Joi.array().items(fileSchema);
    const { error } = validateSchema({ schema: filesArraySchema, body });
    return error ? error.details : null;
};

interface CatalogResponse {
    data: FileProps[] | null;
    errors: string[] | null;
}

export const filePathIsUnique = async (file: FileProps): Promise<boolean> => {
    const response: CatalogResponse = await getCatalog();
    if (response.data && !response.errors) {
        const allFilesInNamespace: FileProps[] = response.data.filter((f: FileProps) => f.namespace === file.namespace);
        const fileExists = allFilesInNamespace.find((f: FileProps) => f.unique_name === file.unique_name);
        return !fileExists;
    }
    logger.error(response.errors);
    return false;
};
