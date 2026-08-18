// Mimetypes served as-is: never converted to WebP and exposed through the /original route.
export const NON_TRANSFORMABLE_MIMETYPES = ['application/pdf', 'image/svg+xml', 'image/gif'];

export const isNonTransformableMimetype = (mimetype?: string): boolean => NON_TRANSFORMABLE_MIMETYPES.includes(mimetype ?? '');
