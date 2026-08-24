import { describe, expect, it, vi } from 'vitest';
import { RestoreOperationGate } from './RestoreOperationGate';

describe('RestoreOperationGate', () => {
    it('rejects an overlapping restore and remains locked after success', async () => {
        const gate = new RestoreOperationGate();
        let finish!: () => void;
        const first = gate.run(() => new Promise<void>(resolve => { finish = resolve; }));
        await expect(gate.run(async () => undefined)).rejects.toThrow('RESTORE_IN_PROGRESS');
        finish();
        await first;
        await expect(gate.run(async () => undefined)).rejects.toThrow('RESTORE_IN_PROGRESS');
    });

    it('unlocks after failure so a corrected restore can retry', async () => {
        const gate = new RestoreOperationGate();
        await expect(gate.run(async () => { throw new Error('INVALID_RECOVERY_CODE'); }))
            .rejects.toThrow('INVALID_RECOVERY_CODE');
        const retry = vi.fn(async () => 'restored');
        await expect(gate.run(retry)).resolves.toBe('restored');
        expect(retry).toHaveBeenCalledOnce();
    });
});
