import { DatabaseService } from './DatabaseService';
import log from 'electron-log';

const API_URL = process.env['CLOUD_API_URL'] || 'http://127.0.0.1:3001/api/v1'; // Use IP to avoid resolution issues
const APP_SECRET = 'nalam_build_secret_v1'; // Must match Server

export class CloudSyncService {
    private dbService: DatabaseService;
    private pollingInterval: NodeJS.Timeout | null = null;
    private isPolling = false;

    constructor(dbService: DatabaseService) {
        this.dbService = dbService;
    }

    init() {
        const settings = this.dbService.getSettings();
        if (settings?.cloud_enabled) {
            this.startPolling();
        }
    }

    async getStatus() {
        const settings = this.dbService.getSettings();
        if (!settings) return { enabled: false, clinicId: null };
        return {
            enabled: !!settings.cloud_enabled,
            clinicId: settings.cloud_clinic_id
        };
    }

    async onboard(clinicName: string, city: string) {
        try {
            const response = await fetch(`${API_URL}/onboard`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-app-secret': APP_SECRET
                },
                body: JSON.stringify({ name: clinicName, city })
            });

            if (!response.ok) throw new Error('Onboarding failed');

            const data: any = await response.json();

            // Save Credentials
            this.dbService.saveSettings({
                cloud_clinic_id: data.clinicId,
                cloud_api_key: data.apiKey,
                cloud_enabled: 1
            });

            return { success: true, clinicId: data.clinicId };
        } catch (e: any) {
            log.error('Cloud Onboard Error:', e);
            throw e;
        }
    }

    async setEnabled(enabled: boolean) {
        this.dbService.saveSettings({ cloud_enabled: enabled ? 1 : 0 });
        if (enabled) {
            this.startPolling();
        } else {
            this.stopPolling();
        }
    }

    startPolling() {
        if (this.pollingInterval) return;
        console.log('[Cloud] Starting Poller...');

        // Initial Poll
        this.poll();

        // Loop every 30s
        this.pollingInterval = setInterval(() => this.poll(), 30000);
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
            log.info('[Cloud] Poller Stopped.');
        }
    }

    async publishSlots(slots: any[], dates: string[]) {
        const settings = this.dbService.getSettings();
        if (!settings?.cloud_enabled || !settings?.cloud_api_key) {
            throw new Error('Cloud sync not enabled');
        }

        try {
            await fetch(`${API_URL}/slots`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-clinic-id': settings.cloud_clinic_id,
                    'x-api-key': settings.cloud_api_key
                },
                body: JSON.stringify({ slots, dates })
            });
        } catch (e) {
            log.error('[Cloud] Publish Slots Error:', e);
            throw e;
        }
    }

    async getPublishedSlots(date: string) {
        const settings = this.dbService.getSettings();
        if (!settings?.cloud_enabled || !settings?.cloud_api_key) {
            log.warn('[Cloud] getPublishedSlots: Cloud disabled or no API key');
            return [];
        }

        try {
            const url = `${API_URL}/slots/${settings.cloud_clinic_id}?date=${date}`;
            log.info(`[Cloud] Fetching slots from: ${url}`);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'x-api-key': settings.cloud_api_key
                }
            });

            if (!response.ok) {
                log.error(`[Cloud] Get Slots Failed: ${response.status} ${response.statusText}`);
                const text = await response.text();
                log.error(`[Cloud] Error Body: ${text}`);
                return [];
            }

            const slots = await response.json();
            log.info(`[Cloud] Fetched ${slots.length} slots for ${date}`);
            return slots;
        } catch (e) {
            log.error('[Cloud] Get Slots Error:', e);
            return [];
        }
    }

    async poll() {
        // Prevent concurrent polls
        if (this.isPolling) return;
        this.isPolling = true;

        try {
            const settings = this.dbService.getSettings();
            if (!settings?.cloud_enabled || !settings?.cloud_api_key) {
                this.isPolling = false;
                return;
            }

            const response = await fetch(`${API_URL}/sync`, {
                method: 'GET',
                headers: {
                    'x-clinic-id': settings.cloud_clinic_id,
                    'x-api-key': settings.cloud_api_key
                }
            });

            if (!response.ok) {
                log.error(`[Cloud] Sync Failed: ${response.status} ${response.statusText}`);
                this.isPolling = false;
                return;
            }

            const messages: any[] = await response.json();
            if (messages.length === 0) {
                this.isPolling = false;
                return;
            }

            console.log(`[Cloud] Received ${messages.length} messages`);

            // Process Messages
            const processedIds: string[] = [];

            for (const msg of messages) {
                if (msg.type === 'APPOINTMENT_REQUEST') {
                    const { slotId, name, phone, reason, date, time } = msg.payload;
                    log.info(`[Cloud] Processing Request: ${name} for ${date} ${time}`);

                    try {
                        this.dbService.saveAppointmentRequest({
                            id: msg.id, // Use Message ID as Request ID
                            patient_name: name,
                            phone,
                            date,
                            time,
                            reason
                        });
                        processedIds.push(msg.id);
                    } catch (e) {
                        log.error('[Cloud] Save Request Failed', e);
                    }
                }
            }

            // Ack processed messages
            if (processedIds.length > 0) {
                await fetch(`${API_URL}/ack`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-clinic-id': settings.cloud_clinic_id,
                        'x-api-key': settings.cloud_api_key
                    },
                    body: JSON.stringify({ ids: processedIds })
                });
                log.info(`[Cloud] Acked ${processedIds.length} messages`);
            }

        } catch (e) {
            log.error('[Cloud] Poll Error:', e);
        } finally {
            this.isPolling = false;
        }
    }
}
