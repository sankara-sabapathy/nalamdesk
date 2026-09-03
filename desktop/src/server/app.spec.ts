import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const JWT_SECRET = vi.hoisted(() => {
    const secret = process.env['JWT_SECRET'] || 'ipc-queue-http-test-secret';
    process.env['JWT_SECRET'] = secret;
    return secret;
});

import * as jwt from 'jsonwebtoken';
import * as os from 'node:os';
import { ApiServer } from './app';

function authHeader(user: { id: number; role: string; username?: string }) {
    const token = jwt.sign(
        { id: user.id, role: user.role, username: user.username || 'admin' },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
    return `Bearer ${token}`;
}

describe('HTTP /api/ipc queue wrapper', () => {
    let server: ApiServer;
    let db: any;

    beforeEach(() => {
        db = {
            beginWork: vi.fn(),
            endWork: vi.fn(),
            getPermissions: vi.fn().mockReturnValue(['addToQueue', 'updateQueueStatus', 'removeFromQueue', 'beginConsultation']),
            addToQueue: vi.fn().mockReturnValue({ lastInsertRowid: 11 }),
            updateQueueStatus: vi.fn().mockReturnValue({ changes: 1 }),
            updateQueueStatusByPatientId: vi.fn().mockReturnValue({ changes: 1 }),
            removeFromQueue: vi.fn().mockReturnValue({ changes: 1 }),
            getQueue: vi.fn().mockReturnValue([]),
            beginConsultation: vi.fn().mockReturnValue({ id: 70 })
        };
        server = new ApiServer(db, os.tmpdir());
    });

    afterEach(async () => {
        await server.close();
    });

    async function postIpc(method: string, args: unknown[], user = { id: 7, role: 'admin' }) {
        return server.inject({
            method: 'POST',
            url: `/api/ipc/${method}`,
            headers: {
                authorization: authHeader(user),
                'content-type': 'application/json'
            },
            payload: args
        });
    }

    it('unpacks addToQueue [{ patientId, priority }] like Electron IPC and appends user.id', async () => {
        const response = await postIpc('addToQueue', [{ patientId: 42, priority: 2 }]);

        expect(response.statusCode).toBe(200);
        expect(db.addToQueue).toHaveBeenCalledWith(42, 2, 7);
        expect(db.addToQueue).not.toHaveBeenCalledWith({ patientId: 42, priority: 2 });
    });

    it('unpacks updateQueueStatus [{ id, status }] like Electron IPC and appends user.id', async () => {
        const response = await postIpc('updateQueueStatus', [{ id: 9, status: 'waiting' }]);

        expect(response.statusCode).toBe(200);
        expect(db.updateQueueStatus).toHaveBeenCalledWith(9, 'waiting', 7);
    });

    it('unpacks updateQueueStatusByPatientId like Electron IPC', async () => {
        const response = await postIpc('updateQueueStatusByPatientId', [{ patientId: 42, status: 'waiting' }]);

        expect(response.statusCode).toBe(200);
        expect(db.updateQueueStatusByPatientId).toHaveBeenCalledWith(42, 'waiting', 7);
    });

    it('appends authenticated user.id to removeFromQueue(id)', async () => {
        const response = await postIpc('removeFromQueue', [9]);

        expect(response.statusCode).toBe(200);
        expect(db.removeFromQueue).toHaveBeenCalledWith(9, 7);
    });

    it('accepts the same renderer payload on Electron IPC and HTTP for a doctor', async () => {
        const response = await postIpc('addToQueue', [{ patientId: 1, priority: 1 }], {
            id: 15,
            role: 'doctor',
            username: 'doc'
        });

        expect(response.statusCode).toBe(200);
        expect(db.addToQueue).toHaveBeenCalledWith(1, 1, 15);
    });

    it('reuses setup across HTTP IPC calls and unpacks beginConsultation like Electron', async () => {
        const first = await postIpc('addToQueue', [{ patientId: 1, priority: 1 }]);
        const second = await postIpc('beginConsultation', [{ patientId: 1, queueEntryId: 9, startRequestId: 'req-1' }]);

        expect(first.statusCode).toBe(200);
        expect(second.statusCode).toBe(200);
        expect(db.beginConsultation).toHaveBeenCalledWith(
            { patientId: 1, queueEntryId: 9, startRequestId: 'req-1' },
            7
        );
    });
});
