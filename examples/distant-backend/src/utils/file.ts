export const retrieveFileDirFromUniqueName = (uniqueName: string) => {
    return uniqueName.replace(/\.[^/.]+$/, '');
}