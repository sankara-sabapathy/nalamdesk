import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import * as jwt from 'jsonwebtoken';
import { DatabaseService } from '../main/services/DatabaseService';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

// Load env vars if present (e.g. in standalone mode)
dotenv.config();

const JWT_SECRET = process.env['JWT_SECRET'] || crypto.randomBytes(64).toString('hex');

const ALLOWED_IPC_METHODS = [
    'getQueue', 'addToQueue', 'updateQueueStatus', 'updateQueueStatusByPatientId', 'removeFromQueue',
    'getAuditLogs',
    'getAppointmentRequests', 'updateAppointmentRequestStatus',
    'getAppointments', 'saveAppointment',
    'validateUser', 'getPermissions' // Auth/RBAC related if needed via IPC, though mostly handled via token
];

export class ApiServer {
    private fastify: FastifyInstance;
    private dbService: DatabaseService;
    private staticPath: string;

    constructor(dbService: DatabaseService, staticPath: string) {
        this.dbService = dbService;
        this.staticPath = staticPath;
        this.fastify = Fastify({ logger: true });
        this.setup();
    }

    private setup() {
        // CORS
        // CORS
        this.fastify.register(fastifyCors, (instance: any) => {
            return (req: any, callback: any) => {
                const allowedOrigins = process.env['ALLOWED_ORIGINS']
                    ? process.env['ALLOWED_ORIGINS'].split(',')
                    : [];

                // Allow all in Dev if no specific list provided
                if (process.env['NODE_ENV'] === 'development' && allowedOrigins.length === 0) {
                    callback(null, { origin: true });
                    return;
                }

                const origin = req.headers.origin;
                if (allowedOrigins.includes(origin)) {
                    callback(null, { origin: true });
                } else {
                    callback(null, { origin: false });
                }
            };
        });

        console.log(`[API Server] Serving static files from: ${this.staticPath}`);

        this.fastify.register(fastifyStatic, {
            root: this.staticPath,
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

    async start(port: number = 3000, host: string = '0.0.0.0') {
        try {
            await this.fastify.listen({ port, host });
            console.log(`API Server running on http://${host}:${port}`);
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
            // Fastify IP might be ::1 or 127.0.0.1. In Docker/Cloud, it might be the Proxy IP.
            // TODO: In Cloud/Docker behind Nginx/Lightsail LB, trustProxy needs to be set if we want real IP.
            // For now, in "Instance" mode with Docker host network or mapped port, it might be the gateway.
            // We will relax this for Cloud OR make it configurable. 
            // FIXME: Relaxing for Cloud Deployment where Admin access is needed over public IP initially.
            // Ideally, Admin should only be via VPN or restricted IP.
            // Checking ENV to bypass strict check?
            if (process.env['STRICT_ADMIN_IP'] === 'true' && ip !== '127.0.0.1' && ip !== '::1') {
                return reply.code(403).send({ error: 'Admin login restricted to Master System' });
            }
        }

        // Verify Password
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
    private async handleIpcCall(request: FastifyRequest, reply: FastifyReply) {
        const { method } = request.params as any;
        const args = request.body as any[]; // Expect array of args
        const user = (request as any).user;

        // 1. Allowlist Check (Security)
        if (!ALLOWED_IPC_METHODS.includes(method)) {
            return reply.code(404).send({ error: 'Method not found or not allowed' });
        }

        // 2. RBAC Enforcement
        if (!this.checkPermission(user.role, method)) {
            return reply.code(403).send({ error: 'Forbidden' });
        }

        const dbAny = this.dbService as any;

        // 3. Execution using Allowlist
        if (typeof dbAny[method] === 'function') {
            try {
                const result = await dbAny[method](...args);
                return result;
            } catch (e: any) {
                return reply.code(500).send({ error: e.message });
            }
        } else {
            return reply.code(404).send({ error: 'Method not implemented' });
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
