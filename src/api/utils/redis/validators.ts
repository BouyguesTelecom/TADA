import * as Joi from 'joi';
import { FileProps } from './types';
import { logger } from '../logs/winston';

import { getAllFiles } from './operations';

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
    body: any;
}

const _validateSchema = ({ schema, body }: ValidateSchemaProps) => {
    return schema.validate(body, { abortEarly: false });
};

export const validateOneFile = (body: any) => {
    const { error } = _validateSchema({ schema: fileSchema, body });
    return error ? error.details : null;
};

export const validateMultipleFile = (body: any) => {
    const filesArraySchema = Joi.array().items(fileSchema);
    const { error } = _validateSchema({ schema: filesArraySchema, body });
    return error ? error.details : null;
};

export const filePathIsUnique = async (file: FileProps) => {
    const response = await getAllFiles();
    if (response.data && !response.errors) {
        const allFilesInNamespace: FileProps[] = response.data.filter((f: FileProps) => f.namespace === file.namespace);
        const fileExists = allFilesInNamespace.find((f: FileProps) => f.unique_name === file.unique_name);
        return !fileExists;
    }
    logger.error(response.errors);
    return false;
};
