/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CloudService } from './cloud.service';

describe('CloudService', () => {
    let service: CloudService;

    beforeEach(() => {
        service = new CloudService();
        vi.restoreAllMocks();
    });

    afterEach(() => {
        delete (window as any).electron;
    });

    describe('with electron bridge', () => {
        let mockCloud: any;
        let mockDb: any;

        beforeEach(() => {
            mockCloud = {
                publishSlots: vi.fn().mockResolvedValue({ success: true }),
                getPublishedSlots: vi.fn().mockResolvedValue([{ time: '10:00' }]),
                syncNow: vi.fn().mockResolvedValue({ synced: true })
            };
            mockDb = {
                getAppointmentRequests: vi.fn().mockResolvedValue([{ id: '1', status: 'pending' }]),
                updateAppointmentRequestStatus: vi.fn().mockResolvedValue({ success: true }),
                saveAppointment: vi.fn().mockResolvedValue({ id: 1 }),
                getAppointments: vi.fn().mockResolvedValue([{ id: 1, date: '2026-01-01' }])
            };
            (window as any).electron = { cloud: mockCloud, db: mockDb };
        });

        it('should publish slots via IPC', async () => {
            const slots = [{ date: '2026-01-01', time: '10:00' }];
            const dates = ['2026-01-01'];
            const result = await service.publishSlots(slots, dates);
            expect(mockCloud.publishSlots).toHaveBeenCalledWith(slots, dates);
            expect(result).toEqual({ success: true });
        });

        it('should get published slots via IPC', async () => {
            const result = await service.getPublishedSlots('2026-01-01');
            expect(mockCloud.getPublishedSlots).toHaveBeenCalledWith('2026-01-01');
            expect(result).toEqual([{ time: '10:00' }]);
        });

        it('should get appointment requests via IPC', async () => {
            const result = await service.getAppointmentRequests();
            expect(mockDb.getAppointmentRequests).toHaveBeenCalled();
            expect(result).toEqual([{ id: '1', status: 'pending' }]);
        });

        it('should update request status via IPC', async () => {
            const result = await service.updateRequestStatus('1', 'approved');
            expect(mockDb.updateAppointmentRequestStatus).toHaveBeenCalledWith({ id: '1', status: 'approved' });
            expect(result).toEqual({ success: true });
        });

        it('should sync now via IPC', async () => {
            const result = await service.syncNow();
            expect(mockCloud.syncNow).toHaveBeenCalled();
            expect(result).toEqual({ synced: true });
        });

        it('should save appointment via IPC', async () => {
            const appt = { patient_id: 1, date: '2026-01-01' };
            const result = await service.saveAppointment(appt);
            expect(mockDb.saveAppointment).toHaveBeenCalledWith(appt);
            expect(result).toEqual({ id: 1 });
        });

        it('should get appointments via IPC', async () => {
            const result = await service.getAppointments('2026-01-01');
            expect(mockDb.getAppointments).toHaveBeenCalledWith('2026-01-01');
            expect(result).toEqual([{ id: 1, date: '2026-01-01' }]);
        });
    });

    describe('without electron bridge', () => {
        it('publishSlots should return undefined', async () => {
            const result = await service.publishSlots([], []);
            expect(result).toBeUndefined();
        });

        it('getPublishedSlots should return empty array', async () => {
            const result = await service.getPublishedSlots('2026-01-01');
            expect(result).toEqual([]);
        });

        it('getAppointmentRequests should return empty array', async () => {
            const result = await service.getAppointmentRequests();
            expect(result).toEqual([]);
        });

        it('updateRequestStatus should return undefined', async () => {
            const result = await service.updateRequestStatus('1', 'approved');
            expect(result).toBeUndefined();
        });

        it('syncNow should return undefined', async () => {
            const result = await service.syncNow();
            expect(result).toBeUndefined();
        });

        it('saveAppointment should return undefined', async () => {
            const result = await service.saveAppointment({});
            expect(result).toBeUndefined();
        });

        it('getAppointments should return empty array', async () => {
            const result = await service.getAppointments('2026-01-01');
            expect(result).toEqual([]);
        });
    });
});
