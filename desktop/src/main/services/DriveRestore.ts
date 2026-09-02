import { DatabaseService } from './DatabaseService';
import { RestoreOperationGate } from './RestoreOperationGate';

/** Drive restore remains a live-file overwrite plus relaunch, serialized with local restore. */
export async function runDriveRestore(input: {
    gate: RestoreOperationGate;
    dbService: DatabaseService;
    getDbPath: () => string | null | undefined;
    closeDb: () => void;
    downloadFile: (fileId: string, destination: string) => Promise<void>;
    fileId: string;
    onCommitted: () => void;
    drainTimeoutMs?: number;
}): Promise<{ success: true; restartRequired: true }> {
    return input.gate.run(async () => {
        const dbPath = input.getDbPath();
        if (!dbPath) throw new Error('DB not open');
        let liveDatabaseClosed = false;
        try {
            await input.dbService.fence(input.drainTimeoutMs ?? 10_000);
            input.closeDb();
            liveDatabaseClosed = true;
            await input.downloadFile(input.fileId, dbPath);
            input.onCommitted();
            return { success: true, restartRequired: true };
        } catch (error) {
            if (!liveDatabaseClosed) input.dbService.unfence();
            throw error;
        }
    });
}
