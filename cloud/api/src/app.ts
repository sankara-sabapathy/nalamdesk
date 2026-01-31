import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const server = Fastify({
    logger: true
});

// Middleware
server.register(cors);
server.register(helmet, {
    contentSecurityPolicy: false // Allow inline scripts/styles for Angular
});

// Serve Static Web App - REMOVED (Decoupled Architecture)
// The API only serves JSON. CloudFront handles the Frontend.

// SPA Fallback - REMOVED

import apiRoutes from './routes/api';
server.register(apiRoutes, { prefix: '/api/v1' });

// Health Check
server.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
});

const start = async () => {
    try {
        const rawPort = process.env.PORT || '3001';
        const port = parseInt(rawPort, 10);

        if (Number.isNaN(port) || port <= 0 || port > 65535) {
            throw new Error(`Invalid PORT: ${rawPort}`);
        }

        await server.listen({ port, host: '0.0.0.0' });
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();
