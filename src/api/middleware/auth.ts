import { logger } from '../utils/logs/winston';

const JWT_TOKEN = process.env.JWT_TOKEN || 'cooltokenyeah';

export const authMiddleware = async (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token === JWT_TOKEN) {
        return next();
    } else {
        logger.warning(`Unauthorized access attempt.`);
    }

    return res.status(401).send(`You must be authenticated to do this.`);
};
