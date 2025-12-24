import dotenv from 'dotenv';

dotenv.config();

import express from 'express';
// import filesRoutes from './routes/files'
import fileRoutes from './routes/file.route'

const app = express();
const port = 3002;

app.use(express.json());

app.get('/readiness-check', (req: any, res: any) => {
    console.log('Serveur OK');
    return res.send('Serveur OK');
});

// app.use('/files', filesRoutes)
app.use('/files', fileRoutes)


app.listen(port, () => {
    console.log('Serveur démarré sur http://localhost:' + port);
});