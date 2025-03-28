import { ICatalogResponseMulti } from '../interfaces/Icatalog';
import { IFile } from '../interfaces/Ifile';
import { File } from './file.model';

export class Catalog {
    private files: File[] = [];

    constructor(files: Array<IFile | File> = []) {
        this.files = files.map((file) => (file instanceof File ? file : File.from(file)));
    }

    addFile(file: IFile | File): File {
        const fileInstance = file instanceof File ? file : File.from(file);
        this.files.push(fileInstance);
        return fileInstance;
    }

    addFiles(files: Array<IFile | File>): File[] {
        const fileInstances = files.map((file) => (file instanceof File ? file : File.from(file)));
        this.files.push(...fileInstances);
        return fileInstances;
    }

    findById(uuid: string): File | undefined {
        return this.files.find((file) => file.uuid === uuid);
    }

    findByUniqueName(uniqueName: string): File | undefined {
        return this.files.find((file) => file.unique_name === uniqueName);
    }

    updateFile(uuid: string, fileData: Partial<IFile>): File | undefined {
        const fileIndex = this.files.findIndex((file) => file.uuid === uuid);
        if (fileIndex === -1) return undefined;

        this.files[fileIndex] = File.from({ ...this.files[fileIndex], ...fileData });
        return this.files[fileIndex];
    }

    deleteFile(uuid: string): boolean {
        const initialLength = this.files.length;
        this.files = this.files.filter((file) => file.uuid !== uuid);
        return this.files.length < initialLength;
    }

    getAllFiles(): File[] {
        return [...this.files];
    }

    toResponse(): ICatalogResponseMulti {
        return {
            status: 200,
            data: this.files,
            errors: null
        };
    }
}
