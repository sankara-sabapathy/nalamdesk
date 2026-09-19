import { Injectable, signal } from '@angular/core';

/**
 * App-wide attending-doctor picker for admin-initiated consultations.
 * Rendered once in the main layout; any host awaits `request()`.
 *
 * - No doctors -> resolves null (host shows the no-practitioner error).
 * - Exactly one doctor -> resolves immediately without opening the modal.
 * - Several doctors -> opens the modal; resolves the chosen id, or null on cancel.
 */
@Injectable({
    providedIn: 'root'
})
export class DoctorPickService {
    readonly open = signal(false);
    readonly doctors = signal<any[]>([]);

    // Every concurrent request is tracked: two consult starts racing the same
    // modal must both settle. They share the chosen attending doctor, which is
    // safe because the admin explicitly selected that practitioner and each
    // encounter records its own provenance.
    private pendingPicks: Array<(id: number | null) => void> = [];

    request(doctors: any[]): Promise<number | null> {
        const list = doctors || [];
        if (list.length === 0) return Promise.resolve(null);
        if (list.length === 1) return Promise.resolve(list[0].id);
        this.doctors.set(list);
        this.open.set(true);
        return new Promise<number | null>((resolve) => {
            this.pendingPicks.push(resolve);
        });
    }

    choose(id: number | null): void {
        this.open.set(false);
        this.doctors.set([]);
        const waiting = this.pendingPicks;
        this.pendingPicks = [];
        waiting.forEach((resolve) => resolve(id));
    }
}
