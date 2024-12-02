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
    information?: string | null;
    destination?: string | null;
    original_mimetype?: string;
    mimetype?: string;
    signature?: string;
    size?: number | string;
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
