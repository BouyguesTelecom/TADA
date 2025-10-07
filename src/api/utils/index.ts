export const getUniqueName = (path, format) => {
    const strSplittingFormat = `/${ format }/`;

    if (format === 'optimise') {
        const arrayToClean = path.split(strSplittingFormat)[1]?.split('/');
        arrayToClean.shift();
        return `/${ arrayToClean.join('/') }`;
    }

    return `/${ path.split(strSplittingFormat)[1] }`;
};
