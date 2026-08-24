/** Serializes destructive restore attempts for the lifetime of the process. */
export class RestoreOperationGate {
    private inProgress = false;

    async run<T>(operation: () => Promise<T>): Promise<T> {
        if (this.inProgress) throw new Error('RESTORE_IN_PROGRESS');
        this.inProgress = true;
        try {
            // A successful restore keeps the gate locked until the scheduled
            // process relaunch. Failures unlock it so the user can retry.
            return await operation();
        } catch (error) {
            this.inProgress = false;
            throw error;
        }
    }
}
