import { describe, it, expect } from 'vitest';
import { DoctorPickService } from './doctor-pick.service';

describe('DoctorPickService', () => {
    it('resolves null without opening when no doctors are available', async () => {
        const service = new DoctorPickService();
        await expect(service.request([])).resolves.toBeNull();
        expect(service.open()).toBe(false);
    });

    it('resolves the only doctor immediately without opening', async () => {
        const service = new DoctorPickService();
        await expect(service.request([{ id: 10, name: 'Dr. Smith' }])).resolves.toBe(10);
        expect(service.open()).toBe(false);
    });

    it('opens the picker for several doctors and resolves the choice', async () => {
        const service = new DoctorPickService();
        const pending = service.request([
            { id: 10, name: 'Dr. Smith' },
            { id: 11, name: 'Dr. Jones' }
        ]);
        expect(service.open()).toBe(true);
        expect(service.doctors()).toHaveLength(2);
        service.choose(11);
        await expect(pending).resolves.toBe(11);
        expect(service.open()).toBe(false);
        expect(service.doctors()).toHaveLength(0);
    });

    it('resolves null when the picker is cancelled', async () => {
        const service = new DoctorPickService();
        const pending = service.request([
            { id: 10, name: 'Dr. Smith' },
            { id: 11, name: 'Dr. Jones' }
        ]);
        service.choose(null);
        await expect(pending).resolves.toBeNull();
        expect(service.open()).toBe(false);
    });

    it('resolves every concurrent request instead of hanging the earlier ones', async () => {
        const service = new DoctorPickService();
        const first = service.request([
            { id: 10, name: 'Dr. Smith' },
            { id: 11, name: 'Dr. Jones' }
        ]);
        const second = service.request([
            { id: 10, name: 'Dr. Smith' },
            { id: 11, name: 'Dr. Jones' }
        ]);
        service.choose(10);
        await expect(first).resolves.toBe(10);
        await expect(second).resolves.toBe(10);
        expect(service.open()).toBe(false);
    });
});
