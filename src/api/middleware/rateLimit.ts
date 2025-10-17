import setRateLimit from 'express-rate-limit';

export const rateLimitMiddleware = setRateLimit({
    windowMs: Number(process.env.DELEGATED_STORAGE_RATE_LIMIT_WINDOW),
    limit: Number(process.env.DELEGATED_STORAGE_RATE_LIMIT),
    message: '',
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => {
        return `${req.method}-${req.originalUrl}`;
    },
    handler: (_req, res, _next) => {
        return res.status(429).json({ error: 'Too many requests, please try again later.' });
    }
});
