export interface IFile {
    uuid: string;
    namespace: string;
    unique_name: string;
    filename: string;
    mimetype: string;
    size: number;
    signature: string;
    public_url?: string;
    base_host?: string;
    base_url?: string;
    version: number;
    destination?: string;
    information?: string | null;
    expiration_date?: string | null;
    expired?: boolean;
    original_mimetype?: string;
    original_filename?: string;
    toWebp?: boolean;
    external_id?: string;
}
