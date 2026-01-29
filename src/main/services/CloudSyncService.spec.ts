import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CloudSyncService } from './CloudSyncService';
import { DatabaseService } from './DatabaseService';

// Mock dependencies
vi.mock('electron-log');

describe('CloudSyncService', () => {
    let service: CloudSyncService;
    let dbService: DatabaseService;

    // Mock DatabaseService methods
    const mockDb = {
        getSettings: vi.fn(),
        saveSettings: vi.fn(),
        getPatients: vi.fn(),
        savePatient: vi.fn(),
        addToQueue: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // @ts-ignore
        dbService = mockDb as unknown as DatabaseService;
        service = new CloudSyncService(dbService);

        // Mock Fetch
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should onboard successfully and save settings', async () => {
        // Mock Success Response
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ clinicId: 'test-id', apiKey: 'test-key' })
        });

        await service.onboard('My Clinic', 'Chennai');

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/onboard'),
            expect.objectContaining({ method: 'POST' })
        );

        expect(mockDb.saveSettings).toHaveBeenCalledWith({
            cloud_clinic_id: 'test-id',
            cloud_api_key: 'test-key',
            cloud_enabled: 1
        });
    });

    it('should handled poll with no settings', async () => {
        mockDb.getSettings.mockReturnValue(null);
        await service.poll();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should poll, process appointment, and ack', async () => {
        // 1. Setup Settings
        mockDb.getSettings.mockReturnValue({
            cloud_enabled: 1,
            cloud_clinic_id: 'cid',
            cloud_api_key: 'key'
        });

        // 2. Mock Sync Response (1 Appointment)
        (global.fetch as any)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ([{
                    id: 'msg_1',
                    type: 'APPOINTMENT',
                    payload: { name: 'New Patient', phone: '1234567890', reason: 'Fever' }
                }])
            })
            // 3. Mock Ack Response
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            });

        // 4. Mock Patient Lookup (Not Found)
        mockDb.getPatients.mockReturnValue([]);
        mockDb.savePatient.mockReturnValue({ lastInsertRowid: 101 });

        // Act
        await service.poll();

        // Assert
        // Verify Sync Call
        expect(global.fetch).toHaveBeenNthCalledWith(1,
            expect.stringContaining('/sync'),
            expect.objectContaining({ headers: expect.objectContaining({ 'x-api-key': 'key' }) })
        );

        // Verify Patient Saved with NULL defaults (Critical check)
        expect(mockDb.savePatient).toHaveBeenCalledWith(expect.objectContaining({
            name: 'New Patient',
            mobile: '1234567890',
            dob: null, // Critical fix verification
            email: null
        }));

        // Verify Added to Queue
        expect(mockDb.addToQueue).toHaveBeenCalledWith(101, 1, 1);

        // Verify Ack Call
        expect(global.fetch).toHaveBeenNthCalledWith(2,
            expect.stringContaining('/ack'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ ids: ['msg_1'] })
            })
        );
    });

    it('should handle patient already in queue gracefully', async () => {
        mockDb.getSettings.mockReturnValue({ cloud_enabled: 1, cloud_api_key: 'k' });

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ([{
                id: 'msg_1',
                type: 'APPOINTMENT',
                payload: { name: 'Existing', phone: '111', reason: 'Checkup' }
            }])
        });

        // Patient exists
        mockDb.getPatients.mockReturnValue([{ id: 55 }]);

        // Queue throws "already in queue"
        mockDb.addToQueue.mockImplementation(() => {
            throw new Error('Patient already in queue');
        });

        await service.poll();

        // Should still Ack because we consider it "processed"
        expect(global.fetch).toHaveBeenCalledTimes(2); // Sync + Ack
        expect(global.fetch).toHaveBeenLastCalledWith(
            expect.stringContaining('/ack'),
            expect.anything()
        );
    });
});
