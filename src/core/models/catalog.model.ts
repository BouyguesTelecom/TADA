import { IFile } from '../interfaces/Ifile';
import { ICatalogResponseMulti } from '../interfaces/Icatalog';
import { File } from './file.model';

export class Catalog {
    private files: File[] = [];

    constructor(files: Array<IFile | File> = []) {
        this.files = files.map((file) => (file instanceof File ? file : new File(file)));
    }

    addFile(file: IFile | File): File {
        const fileInstance = file instanceof File ? file : new File(file);
        this.files.push(fileInstance);
        return fileInstance;
    }

    addFiles(files: Array<IFile | File>): File[] {
        const fileInstances = files.map((file) => (file instanceof File ? file : new File(file)));
        this.files.push(...fileInstances);
        return fileInstances;
    }

    getFileByUuid(uuid: string): File | undefined {
        return this.files.find((file) => file.uuid === uuid);
    }

    getFileByUniqueName(uniqueName: string): File | undefined {
        return this.files.find((file) => file.unique_name === uniqueName);
    }
    updateFile(uuid: string, fileData: Partial<IFile>): File | undefined {
        const fileIndex = this.files.findIndex((file) => file.uuid === uuid);

        if (fileIndex === -1) {
            return undefined;
        }

        Object.assign(this.files[fileIndex], fileData);
        return this.files[fileIndex];
    }
    deleteFileByUuid(uuid: string): boolean {
        const initialLength = this.files.length;
        this.files = this.files.filter((file) => file.uuid !== uuid);
        return this.files.length < initialLength;
    }

    deleteFileByUniqueName(uniqueName: string): File | undefined {
        const fileToDelete = this.getFileByUniqueName(uniqueName);

        if (!fileToDelete) {
            return undefined;
        }

        this.files = this.files.filter((file) => file.unique_name !== uniqueName);
        return fileToDelete;
    }
    clear(): void {
        this.files = [];
    }

    getAllFiles(): File[] {
        return [...this.files];
    }

    getCount(): number {
        return this.files.length;
    }

    toResponse(): ICatalogResponseMulti {
        return {
            status: 200,
            data: this.files.map((file) => file.toJSON()),
            errors: null
        };
    }
}
