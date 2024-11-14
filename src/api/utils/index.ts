export const getUniqueName = (path, strSplitting) => {
    let unique_name = path.split(strSplitting)[1] || null;
    if (unique_name) {
        if (unique_name.includes('?')) {
            unique_name = unique_name.split('?')[0];
        }
        return unique_name;
    }

    return '';
};
