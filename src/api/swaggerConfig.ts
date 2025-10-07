import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const isDevelopment = process.env.NODE_ENV !== 'production';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'TADA API',
            version: '1.0.0',
            description: 'API documentation for all routes'
        },
        servers: [
            {
                url: (process.env.API_BASE_URL || 'http://localhost:3001') + (process.env.API_PREFIX || ''),
                description: isDevelopment ? 'Development server' : 'Production server'
            }
        ]
    },
    apis: isDevelopment 
        ? ['./src/api/routes/*.ts', './routes/*.ts'] 
        : ['./dist/api/routes/*.js', './routes/*.js']
};

const specs = swaggerJsdoc(options);

export const setupSwagger = (app: Express) => {
    const API_PREFIX = process.env.API_PREFIX || '';
    const swaggerPath = `${API_PREFIX}/api-docs`;
    
    app.use(swaggerPath, swaggerUi.serve, swaggerUi.setup(specs));
    
    // Also serve without prefix for compatibility
    if (API_PREFIX) {
        app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
    }
};
