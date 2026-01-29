/**
 * @vitest-environment jsdom
 */
import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardComponent } from './dashboard.component';
import { DataService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

// Mock services to prevent real code execution
vi.mock('../services/api.service');
vi.mock('../services/auth.service');
vi.mock('@angular/router');

// Mock inject
vi.mock('@angular/core', async () => {
    const actual = await vi.importActual('@angular/core');
    return {
        ...actual as any,
        inject: vi.fn(),
    };
});
import { inject } from '@angular/core';

describe('DashboardComponent', () => {
    let component: DashboardComponent;
    let mockDataService: any;
    let mockNgZone: any;
    let mockRouter: any;
    let mockAuthService: any;

    beforeEach(() => {
        // Create fresh mocks
        mockDataService = { invoke: vi.fn() };
        mockNgZone = { run: vi.fn((fn) => fn()) };
        mockRouter = { navigate: vi.fn() };
        mockAuthService = { getUser: vi.fn() };

        // Setup mocked return values to avoid undefined errors
        mockDataService.invoke.mockImplementation((method) => {
            if (method === 'getSettings') return Promise.resolve({ clinic_name: 'Test Clinic' });
            if (method === 'getDashboardStats') return Promise.resolve({ totalPatients: 10, todayVisits: 5 });
            if (method === 'getQueue') return Promise.resolve([]);
            return Promise.resolve(null);
        });

        component = new DashboardComponent(
            mockRouter,
            mockNgZone,
            mockDataService,
            mockAuthService
        );
    });

    it('should load dashboard stats on init', async () => {
        await component.loadData();

        expect(component.stats).toEqual({ totalPatients: 10, todayVisits: 5 });
        expect(mockDataService.invoke).toHaveBeenCalledWith('getDashboardStats');
    });

    it('should handle errors when loading stats', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => { });
        mockDataService.invoke.mockRejectedValue(new Error('DB Error'));

        await component.loadData();

        expect(spy).toHaveBeenCalled();
    });
});
