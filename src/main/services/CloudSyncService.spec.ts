import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CloudSyncService } from './CloudSyncService';
import { DatabaseService } from './DatabaseService';

// Mock dependencies
vi.mock('electron-log');

describe('CloudSyncService', () => {
    let service: CloudSyncService;
    let dbService: DatabaseService;
    let mockDb: any;
    let originalFetch: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock DB Setup per test
        mockDb = {
            getSettings: vi.fn(),
            saveSettings: vi.fn(),
            getPatients: vi.fn(),
            savePatient: vi.fn(),
            addToQueue: vi.fn(),
            saveAppointmentRequest: vi.fn()
        };

        dbService = mockDb as unknown as DatabaseService;
        service = new CloudSyncService(dbService);

        // Mock Fetch
        originalFetch = global.fetch;
        global.fetch = vi.fn();
    });

    afterEach(() => {
        global.fetch = originalFetch;
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

    it('should handle poll with no settings', async () => {
        mockDb.getSettings.mockReturnValue(null);
        await service.poll();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should poll, process appointment request, and ack', async () => {
        // 1. Setup Settings
        mockDb.getSettings.mockReturnValue({
            cloud_enabled: 1,
            cloud_clinic_id: 'cid',
            cloud_api_key: 'key'
        });

        // 2. Mock Sync Response
        (global.fetch as any)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ([{
                    id: 'msg_1',
                    type: 'APPOINTMENT_REQUEST',
                    payload: {
                        slotId: 'slot_1',
                        name: 'New Patient',
                        phone: '1234567890',
                        reason: 'Fever',
                        date: '2023-01-01',
                        time: '10:00'
                    }
                }])
            })
            // 3. Mock Ack Response
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            });

        // Act
        await service.poll();

        // Assert
        // Verify Sync Call
        expect(global.fetch).toHaveBeenNthCalledWith(1,
            expect.stringContaining('/sync'),
            expect.objectContaining({ headers: expect.objectContaining({ 'x-api-key': 'key' }) })
        );

        // Verify Save Request (Not Patient/Queue)
        expect(mockDb.saveAppointmentRequest).toHaveBeenCalledWith(expect.objectContaining({
            id: 'msg_1',
            patient_name: 'New Patient',
            phone: '1234567890',
            date: '2023-01-01',
            time: '10:00'
        }));

        // Verify Ack Call
        expect(global.fetch).toHaveBeenNthCalledWith(2,
            expect.stringContaining('/ack'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ ids: ['msg_1'] })
            })
        );
    });

    it('should handle request save failure but still continue', async () => {
        // Updated mock to include clinic_id so poll proceeds
        mockDb.getSettings.mockReturnValue({ cloud_enabled: 1, cloud_api_key: 'k', cloud_clinic_id: 'clinic_1' });

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ([{
                id: 'msg_1',
                type: 'APPOINTMENT_REQUEST',
                payload: { name: 'Bad Data' }
            }])
        });

        // Mock error
        // @ts-ignore
        mockDb.saveAppointmentRequest = vi.fn().mockImplementation(() => {
            throw new Error('Save failed');
        });

        await service.poll();

        // Should NOT Ack if processing failed (logic says: try...catch around save, if catch log error. Does it push to processedIds? No, push is inside try block)
        // So it should NOT Ack.
        expect(global.fetch).toHaveBeenCalledTimes(1); // Sync only
    });
});
