import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import * as path from 'path';
import * as jwt from 'jsonwebtoken';
import { DatabaseService } from './services/DatabaseService';
import { app } from 'electron';
import * as argon2 from 'argon2';

import * as crypto from 'crypto';

const JWT_SECRET = process.env['JWT_SECRET'] || crypto.randomBytes(64).toString('hex');

export class ApiServer {
    private fastify: FastifyInstance;
    private dbService: DatabaseService;

    constructor(dbService: DatabaseService) {
        this.dbService = dbService;
        this.fastify = Fastify({ logger: true });
        this.setup();
    }

    private setup() {
        // CORS
        this.fastify.register(fastifyCors, {
            origin: true // Allow all for local LAN
        });

        // Static Files (Angular App)
        // In Dev, we are running from dist/main, so we go up one level.
        // In Prod, app.getAppPath() points to the root of the packaged app.
        const isDev = !app.isPackaged;
        const staticPath = isDev
            ? path.join(__dirname, '../nalamdesk/browser')
            : path.join(app.getAppPath(), 'dist/nalamdesk/browser');

        console.log(`[API Server] Serving static files from: ${staticPath}`);

        this.fastify.register(fastifyStatic, {
            root: staticPath,
            prefix: '/', // optional: default '/'
        });

        // API Routes
        this.fastify.post('/api/auth/login', this.handleLogin.bind(this));

        // Protected Routes
        this.fastify.register(async (instance) => {
            instance.addHook('preValidation', this.authenticate.bind(this));

            // Data Wrappers
            instance.post('/api/ipc/:method', this.handleIpcCall.bind(this));
        });

        // SPA Fallback
        this.fastify.setNotFoundHandler((req, reply) => {
            if (req.method === 'GET' && !req.url.startsWith('/api')) {
                return reply.sendFile('index.html');
            }
            return reply.code(404).send({ message: 'Route ' + req.method + ':' + req.url + ' not found', error: 'Not Found', statusCode: 404 });
        });
    }

    async start() {
        try {
            await this.fastify.listen({ port: 3000, host: '0.0.0.0' });
            console.log('API Server running on http://0.0.0.0:3000');
        } catch (err) {
            this.fastify.log.error(err);
        }
    }

    // Middleware: Auth
    private async authenticate(request: FastifyRequest, reply: FastifyReply) {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader) throw new Error('No token provided');
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET) as any;
            (request as any).user = decoded;
        } catch (err) {
            reply.code(401).send({ error: 'Unauthorized' });
            return; // Short-circuit
        }
    }

    // Login Handler
    private async handleLogin(request: FastifyRequest, reply: FastifyReply) {
        const { username, password } = request.body as any;
        const user = this.dbService.getUserByUsername(username);

        if (!user || user.active === 0) {
            return reply.code(401).send({ error: 'Invalid credentials' });
        }

        // Admin IP Restriction
        if (user.role === 'admin') {
            const ip = request.ip;
            // Fastify IP might be ::1 or 127.0.0.1
            if (ip !== '127.0.0.1' && ip !== '::1') {
                return reply.code(403).send({ error: 'Admin login restricted to Master System' });
            }
        }

        // Verify Password
        // Note: Admin might be seeded with raw hash string if not careful, but saveUser hashes it.
        // If we seeded admin specifically we need to match that.
        // Assuming argon2 hash is stored.
        try {
            if (await argon2.verify(user.password, password)) {
                const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SECRET, { expiresIn: '12h' });
                return { token, user: { id: user.id, username: user.username, role: user.role, name: user.name } };
            } else {
                return reply.code(401).send({ error: 'Invalid credentials' });
            }
        } catch (e) {
            return reply.code(500).send({ error: 'Auth error' });
        }
    }

    // Generic IPC wrapper for DataService
    // This allows the frontend to call dbService methods purely by name, controlled by RBAC here.
    private async handleIpcCall(request: FastifyRequest, reply: FastifyReply) {
        const { method } = request.params as any;
        const args = request.body as any[]; // Expect array of args
        const user = (request as any).user;

        // RBAC Enforcement
        if (!this.checkPermission(user.role, method)) {
            return reply.code(403).send({ error: 'Forbidden' });
        }

        // Map method names to actual dbService calls
        // This is a dynamic dispatch. Secure? We whitelist permissions.
        if (typeof (this.dbService as any)[method] === 'function') {
            try {
                const result = await (this.dbService as any)[method](...args);
                return result;
            } catch (e: any) {
                return reply.code(500).send({ error: e.message });
            }
        } else {
            return reply.code(404).send({ error: 'Method not found' });
        }
    }

    private checkPermission(role: string, method: string): boolean {
        // Admin: All access
        if (role === 'admin') return true;

        // Dynamic DB-based RBAC
        try {
            const permissions = this.dbService.getPermissions(role);
            return permissions.includes(method);
        } catch (e) {
            console.error(`[RBAC] Permission check failed for role ${role}:`, e);
            return false;
        }
    }
}
