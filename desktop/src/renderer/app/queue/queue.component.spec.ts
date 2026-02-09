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
                        { id: 1, patient_name: 'P1', priority: 1, status: 'waiting', check_in_time: new Date().toISOString() },
                        { id: 2, patient_name: 'P2', priority: 2, status: 'waiting', check_in_time: new Date().toISOString() }
                    ]);
                }
                if (endpoint === 'updateQueueStatus') return Promise.resolve();
                return Promise.resolve(null);
            })
        };

        mockRouter = {
            navigate: vi.fn()
        };

        component = new QueueComponent(mockRouter, mockDataService);
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

    it('should update status', async () => {
        // Need to set initial queue state for find() to work
        component.queue.set([{ id: 1, patient_name: 'P1' }]);

        await component.updateStatus(1, 'completed');
        expect(mockDataService.invoke).toHaveBeenCalledWith('updateQueueStatus', { id: 1, status: 'completed' });
        expect(mockDataService.invoke).toHaveBeenCalledWith('getQueue'); // Should reload
    });
});
