export function verifyToken(req: any, res: any, next: any) {
    const token = req.headers.authorization;
    if (token !== process.env.TOKEN) {
        console.log('Token incorrect:', token);
        return res.status(401).json({ error: 'Non autorisé' });
    }
    next(); 
}