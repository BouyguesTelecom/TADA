export interface FileProps {
    uuid?: string;
    filename?: string;
    namespace?: string;
    unique_name?: string;
    expiration_date?: string;
    expired?: boolean;
    external_id?: string;
    version?: number;
    public_url?: string;
    original_filename?: string;
    base_url?: string;
    base_host?: string;
    information?: string | null;
    destination?: string | null;
    original_mimetype?: string;
    mimetype?: string;
    signature?: string;
    size?: number | string;
    uploaded_date?: string;
    updated_date?: string;
    original_signature?: string;
    original_version?: number;
}

export interface ICatalogResponse {
    status?: number;
    datum: FileProps | null;
    error: string | null;
}

export interface ICatalogResponseMulti {
    status: number;
    data: FileProps[] | null;
    errors: string[] | null;
}
