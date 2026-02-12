import '@angular/compiler';
console.log('Test Setup (Pure) Running');

// Mock global electron if needed by any stray code, though typically services handle this
(window as any).electron = {
    db: {
        getPatients: () => Promise.resolve([]),
        getQueue: () => Promise.resolve([]),
        getDashboardStats: () => Promise.resolve({ totalPatients: 0, todayVisits: 0 }),
        getSettings: () => Promise.resolve({}),
    }
};

// No Zone.js imports!
