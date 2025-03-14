import { IFile } from '../interfaces/Ifile';

export class File implements IFile {
    uuid?: string;
    filename?: string;
    namespace?: string;
    unique_name?: string;
    expiration_date?: string;
    expired: boolean = false;
    external_id?: string;
    version: number = 1;
    public_url?: string;
    original_filename?: string;
    base_url?: string;
    information: string | null = null;
    destination: string | null = null;
    original_mimetype?: string;
    mimetype?: string;
    signature?: string;
    size?: number | string;

    constructor(props: Partial<IFile> = {}) {
        Object.assign(this, props);

        if (!this.uuid) {
            this.uuid = this.generateUUID();
        }

        this.expired = this.isExpired();
    }

    isExpired(): boolean {
        if (!this.expiration_date) {
            return false;
        }
        return new Date(this.expiration_date) < new Date();
    }

    getPublicUrl(): string | undefined {
        if (this.public_url) {
            return this.public_url;
        }

        if (this.base_url && this.unique_name) {
            return `${this.base_url}/${this.unique_name}`;
        }

        return undefined;
    }

    private generateUUID(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = (Math.random() * 16) | 0,
                v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    toJSON(): Record<string, any> {
        return {
            ...this,
            expired: this.isExpired(),
            public_url: this.getPublicUrl()
        };
    }
}
