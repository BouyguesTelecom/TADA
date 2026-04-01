import dotenv from 'dotenv';
import express from 'express';
import { manyRouter, oneRouter } from './routes/file.route';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const port = 3002;

app.use((req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
        return next();
    }
    express.json()(req, res, next);
});

app.get('/readiness-check', (req: any, res: any) => {
    console.log('Readiness check received');
    return res.send('OK');
});

if (!process.env.UPLOAD_DIR) {
    console.error('❌ Env variable UPLOAD_DIR must be set');
    process.exit(1);
}

app.use((req, res, next) => {
    console.log(`\n[${new Date().toISOString()}] - ${req.method} - ${req.url}`);
    next();
});

app.use('/file', oneRouter);
app.use('/files', manyRouter);

app.use((err: any, req: any, res: any, next: any) => {
    console.error('[ERROR MIDDLEWARE]', err.message, err.stack);
    res.status(500).json({ error: err.message });
});

app.listen(port, () => {
    console.log('⚡️ Server ready and available on http://localhost:' + port);
});
