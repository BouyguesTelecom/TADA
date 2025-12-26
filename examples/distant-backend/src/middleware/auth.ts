export function verifyToken(req: any, res: any, next: any) {
    const token = req.headers.authorization;
    if (token !== process.env.TOKEN) {
        console.log('Unauthorized, token not valid');
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}
