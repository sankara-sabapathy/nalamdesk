console.log('Test Setup Running');
import 'zone.js';
// import 'zone.js/testing';
import '@angular/compiler';
import { getTestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

const testBed = getTestBed();
testBed.resetTestEnvironment();
testBed.initTestEnvironment(
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting()
);


// Mock Electron
(window as any).electron = {
    db: {
        getPatients: () => Promise.resolve([]),
        getQueue: () => Promise.resolve([]),
        getDashboardStats: () => Promise.resolve({ totalPatients: 0, todayVisits: 0 }),
        getSettings: () => Promise.resolve({}),
    }
};
