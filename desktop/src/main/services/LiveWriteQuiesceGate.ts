/** Stops new live writes and drains in-flight ones before restore closes the vault. */
export class LiveWriteQuiesceGate {
    private accepting = true;
    private inFlight = 0;
    private drain: Array<() => void> = [];

    tryEnter(): boolean {
        if (!this.accepting) return false;
        this.inFlight++;
        return true;
    }

    leave(): void {
        if (this.inFlight > 0) this.inFlight--;
        if (this.inFlight === 0) {
            const waiters = this.drain.splice(0);
            for (const done of waiters) done();
        }
    }

    async quiesce(): Promise<void> {
        this.accepting = false;
        if (this.inFlight === 0) return;
        await new Promise<void>(resolve => this.drain.push(resolve));
    }

    resume(): void {
        this.accepting = true;
    }
}
