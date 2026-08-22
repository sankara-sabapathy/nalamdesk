/**
 * @vitest-environment jsdom
 */
import '@angular/compiler';
import { describe, xdescribe, it, expect, vi, beforeEach } from 'vitest';
import { QueueComponent } from './queue.component';

// Mock inject/core to prevent Zone issues
vi.mock('@angular/core', async () => {
    const actual = await vi.importActual('@angular/core');
    return {
        ...actual as any,
        inject: vi.fn(),
    };
});
import { inject } from '@angular/core';

// Mock Services
// vi.mock('../services/api.service'); // Removed, using manual mock object

describe('QueueComponent', () => {
    let component: QueueComponent;
    let mockDataService: any;
    let mockRouter: any;

    beforeEach(() => {
        mockDataService = {
            invoke: vi.fn().mockImplementation((endpoint: string) => {
                if (endpoint === 'getQueue') {
                    return Promise.resolve([
                        { id: 1, patient_id: 11, patient_name: 'P1', priority: 1, status: 'waiting', check_in_time: new Date().toISOString() },
                        { id: 2, patient_id: 22, patient_name: 'P2', priority: 2, status: 'waiting', check_in_time: new Date().toISOString() }
                    ]);
                }
                if (endpoint === 'beginConsultation') return Promise.resolve({ id: 101, patient_id: 11 });
                if (endpoint === 'resumeConsultation') return Promise.resolve({ id: 102, patient_id: 11 });
                return Promise.resolve(null);
            })
        };

        mockRouter = {
            navigate: vi.fn()
        };

        component = new QueueComponent(mockRouter, mockDataService);
    });

    it('should resume the exact linked encounter for a postponed queue item', async () => {
        const item = { id: 1, patient_id: 11, patient_name: 'P1', status: 'waiting', active_encounter_id: 102 };

        await component.startConsult(item);

        expect(mockDataService.invoke).toHaveBeenCalledWith('resumeConsultation', { encounterId: 102 });
        expect(mockDataService.invoke.mock.calls.some((call: any[]) => call[0] === 'beginConsultation')).toBe(false);
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/visit', 11], {
            state: { isConsulting: true, encounterId: 102, patientName: 'P1' }
        });
    });

    it('should create and load queue', async () => {
        component.ngOnInit();
        // Wait for async refreshQueue
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(component).toBeTruthy();
        expect(mockDataService.invoke).toHaveBeenCalledWith('getQueue');
        const queue = component.queue();
        expect(queue.length).toBe(2);
        expect(queue.find((q: any) => q.priority === 2)?.patient_name).toBe('P2');
    });

    it('should atomically start an encounter before navigating', async () => {
        const item = { id: 1, patient_id: 11, patient_name: 'P1' };

        await component.startConsult(item);
        expect(mockDataService.invoke).toHaveBeenCalledWith('beginConsultation', expect.objectContaining({
            patientId: 11,
            queueEntryId: 1,
            startRequestId: expect.any(String)
        }));
        expect(mockDataService.invoke).toHaveBeenCalledWith('getQueue'); // Should reload
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/visit', 11], {
            state: { isConsulting: true, encounterId: 101, patientName: 'P1' }
        });
    });
});
