import { IFile } from '../interfaces/Ifile';

export class File implements IFile {
    uuid: string;
    namespace: string;
    unique_name: string;
    filename: string;
    mimetype: string;
    size: number;
    signature: string;
    public_url: string;
    base_host: string;
    version: number;
    destination?: string;
    information?: string | null;
    expiration_date?: string | null;
    expired?: boolean;
    original_mimetype?: string;

    constructor(file: Partial<IFile>) {
        this.uuid = file.uuid || '';
        this.namespace = file.namespace || '';
        this.unique_name = file.unique_name || '';
        this.filename = file.filename || '';
        this.mimetype = file.mimetype || '';
        this.size = file.size || 0;
        this.signature = file.signature || '';
        this.version = file.version || 1;
        this.destination = file.destination;
        this.information = file.information;
        this.expiration_date = file.expiration_date;
        this.expired = file.expired || false;
        this.original_mimetype = file.original_mimetype;
        this.base_host = file.base_host || process.env.NGINX_INGRESS || 'http://localhost:8080';

        this.public_url = file.public_url || `${this.base_host}/assets/media/full${this.unique_name}`;
    }

    isExpired(): boolean {
        if (this.expired) return true;

        if (this.expiration_date) {
            const expirationDate = new Date(this.expiration_date);
            const currentDate = new Date();
            return expirationDate <= currentDate;
        }

        return false;
    }

    toJSON(): IFile {
        const obj: any = { ...this };
        Object.keys(obj).forEach((key) => {
            if (obj[key] === undefined) {
                delete obj[key];
            }
        });
        return obj;
    }
}
