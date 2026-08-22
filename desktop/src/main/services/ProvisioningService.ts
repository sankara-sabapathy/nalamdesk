export interface VaultProvisioner {
    setup(adminPassword: string, dbPath: string, userDataPath: string): Promise<string>;
    getDb(): any;
    completeProvisioning(): void;
    abortProvisioning(): void;
}

export interface ProvisioningDatabase {
    setDb(db: any): void;
    migrate(options?: { skipBackup?: boolean }): Promise<void>;
    saveSettings(settings: any): unknown;
    ensureAdminUser(password: string): Promise<void>;
}

/** Coordinates the full fresh-install transaction across vault and application data. */
export class ProvisioningService {
    constructor(
        private readonly security: VaultProvisioner,
        private readonly database: ProvisioningDatabase
    ) { }

    async provision(
        adminPassword: string,
        clinicDetails: any,
        dbPath: string,
        userDataPath: string
    ): Promise<string> {
        try {
            const recoveryCode = await this.security.setup(adminPassword, dbPath, userDataPath);
            this.database.setDb(this.security.getDb());
            await this.database.migrate({ skipBackup: true });
            this.database.saveSettings(clinicDetails);
            await this.database.ensureAdminUser(adminPassword);
            this.security.completeProvisioning();
            return recoveryCode;
        } catch (error) {
            this.security.abortProvisioning();
            this.database.setDb(null);
            throw error;
        }
    }
}
