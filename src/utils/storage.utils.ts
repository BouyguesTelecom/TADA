import { IFile } from '../core/interfaces/Ifile';
import { StorageFileProps } from '../infrastructure/storage/baseStorage';

export class StorageUtils {
    static prepareMetadata(fileBuffer: Buffer, metadata: Partial<IFile>): StorageFileProps['metadata'] {
        const filepath = metadata.unique_name || metadata.filename || '';
        const filename = filepath.split('/').pop() || 'file';

        return {
            unique_name: filepath,
            base_url: metadata.base_url || process.env.NGINX_INGRESS || 'http://localhost:8080',
            destination: metadata.destination || '',
            filename,
            mimetype: metadata.mimetype || this.getMimeType(filename),
            size: fileBuffer.length,
            namespace: metadata.namespace || 'default',
            version: metadata.version || 1,
            ...metadata
        };
    }

    static generatePublicUrl(filepath: string): string {
        const baseUrl = process.env.NGINX_INGRESS || 'http://localhost:8080';
        return `${baseUrl}/assets/media/full${filepath}`;
    }

    static validateFileProps(props: StorageFileProps): string | null {
        if (!props.filepath) {
            return 'Filepath is required';
        }

        if (!props.file) {
            return 'File content is required';
        }

        if (!props.metadata?.unique_name) {
            return 'Unique name is required in metadata';
        }

        if (props.metadata.size && props.metadata.size !== props.file.length) {
            return 'File size mismatch';
        }

        return null;
    }

    static async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
        return new Promise<Buffer>((resolve, reject) => {
            const chunks: Buffer[] = [];

            stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
            stream.on('error', (err) => reject(err));
        });
    }

    private static getMimeType(filename: string): string {
        const ext = filename.split('.').pop()?.toLowerCase();
        const mimeTypes: Record<string, string> = {
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            webp: 'image/webp',
            pdf: 'application/pdf',
            json: 'application/json'
        };

        return mimeTypes[ext || ''] || 'application/octet-stream';
    }
}
