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

// Serve Static Web App
import fastifyStatic from '@fastify/static';

server.register(fastifyStatic, {
    root: path.join(__dirname, '../../web/dist/web/browser'),
    prefix: '/', // Serve at root
    wildcard: false // Handle 404 manually for SPA fallback
});

// SPA Fallback: Send index.html for any unknown route (except /api)
server.setNotFoundHandler((req, reply) => {
    if (req.raw.url?.startsWith('/api')) {
        reply.code(404).send({ error: 'Endpoint not found' });
    } else {
        reply.sendFile('index.html');
    }
});

import apiRoutes from './routes/api';
server.register(apiRoutes, { prefix: '/api/v1' });

// Health Check
server.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
});

const start = async () => {
    try {
        const port = parseInt(process.env.PORT || '3001');
        await server.listen({ port, host: '0.0.0.0' });
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();
