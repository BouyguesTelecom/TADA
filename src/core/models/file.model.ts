import { v4 as uuidv4 } from 'uuid';
import { IFile } from '../interfaces/Ifile';
export class File implements IFile {
    constructor(
        public uuid: string = '',
        public namespace: string = '',
        public unique_name: string = '',
        public filename: string = '',
        public mimetype: string = '',
        public size: number = 0,
        public signature: string = '',
        public version: number = 1,
        public public_url?: string,
        public base_host?: string,
        public base_url?: string,
        public destination?: string,
        public information?: string | null,
        public expiration_date?: string | null,
        public expired: boolean = false,
        public original_mimetype?: string,
        public original_filename?: string,
        public toWebp?: boolean
    ) {
        this.base_host = base_host || process.env.NGINX_INGRESS || 'http://localhost:8080';
        this.public_url = public_url || `${this.base_host}/assets/media/full${this.unique_name}`;
    }

    static async create(data: Partial<IFile>): Promise<File> {
        return new File(
            data.uuid,
            data.namespace,
            data.unique_name,
            data.filename,
            data.mimetype,
            data.size,
            data.signature,
            data.version,
            data.public_url,
            data.base_host,
            data.base_url,
            data.destination,
            data.information,
            data.expiration_date,
            data.expired,
            data.original_mimetype,
            data.original_filename,
            data.toWebp
        );
    }

    static from(data: Partial<IFile>): File {
        return new File(
            data.uuid || uuidv4(),
            data.namespace || '',
            data.unique_name || '',
            data.filename || '',
            data.mimetype || '',
            data.size || 0,
            data.signature || '',
            data.version || 1,
            data.public_url,
            data.base_host,
            data.base_url,
            data.destination,
            data.information,
            data.expiration_date,
            data.expired,
            data.original_mimetype,
            data.original_filename,
            data.toWebp
        );
    }

    isExpired(): boolean {
        return this.expired || (this.expiration_date && new Date(this.expiration_date) <= new Date());
    }
}
