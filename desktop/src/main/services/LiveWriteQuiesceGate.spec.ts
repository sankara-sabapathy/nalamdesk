import { describe, expect, it } from 'vitest';
import { LiveWriteQuiesceGate } from './LiveWriteQuiesceGate';

describe('LiveWriteQuiesceGate', () => {
    it('rejects new writes after quiesce and drains an in-flight write first', async () => {
        const gate = new LiveWriteQuiesceGate();
        expect(gate.tryEnter()).toBe(true);
        const drained = gate.quiesce();
        let resolved = false;
        void drained.then(() => { resolved = true; });
        await Promise.resolve();
        expect(resolved).toBe(false);
        expect(gate.tryEnter()).toBe(false);
        gate.leave();
        await drained;
        expect(resolved).toBe(true);
        expect(gate.tryEnter()).toBe(false);
    });

    it('resumes accepting writes after a failed restore', async () => {
        const gate = new LiveWriteQuiesceGate();
        expect(gate.tryEnter()).toBe(true);
        gate.leave();
        await gate.quiesce();
        expect(gate.tryEnter()).toBe(false);
        gate.resume();
        expect(gate.tryEnter()).toBe(true);
        gate.leave();
    });
});
