import { FileProps } from '../props/catalog';
import { calculateSHA256} from '../utils/catalog';
import { logger } from '../utils/logs/winston';

export const checkSignature = async (file: FileProps, buffer: Buffer, originalFile: Boolean): Promise<{ isValidSignature: boolean; originSignature: string | null }> => {
    try {
        const signature = calculateSHA256(buffer);
        return {
            isValidSignature: (originalFile ? file.original_signature : file.signature) === signature,
            originSignature: signature
        };
    } catch (error) {
        logger.error('Error checking signature:', error);
        return { isValidSignature: false, originSignature: null };
    }
};

export const streamToBuffer = async (stream) => {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
};
