import { logger } from '../utils/logs/winston';

const MEDIA_TOKEN = process.env.MEDIA_TOKEN;

export const authMiddleware = async (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    console.log('TOKEN::::', token, 'MEDIA TOKEN::::', MEDIA_TOKEN);
    if (token === MEDIA_TOKEN) {
        return next();
    } else {
        logger.warning(`Unauthorized access attempt.`);
    }

    return res.status(401).send(`You must be authenticated to do this.`);
};
