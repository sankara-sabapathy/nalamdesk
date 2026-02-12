import { google } from 'googleapis';
import * as http from 'http';
import * as url from 'url';
import { BrowserWindow } from 'electron';
import * as fs from 'fs';

// Dynamic credentials configured via Settings
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

export class GoogleDriveService {
    private oauth2Client: any = null;
    private drive: any = null;
    private tokens: any = null;
    private clientId: string = '';
    private clientSecret: string = '';

    constructor() { }

    configureCredentials(clientId: string, clientSecret: string) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;

        if (this.clientId && this.clientSecret) {
            this.oauth2Client = new google.auth.OAuth2(
                this.clientId,
                this.clientSecret,
                REDIRECT_URI
            );
            this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
        }
    }

    setCredentials(tokens: any) {
        this.tokens = tokens;
        if (this.oauth2Client) {
            this.oauth2Client.setCredentials(tokens);
        }
    }

    getCredentials() {
        return this.tokens;
    }

    isAuthenticated(): boolean {
        return !!this.tokens && !!this.oauth2Client;
    }

    async authenticate(mainWindow: BrowserWindow): Promise<boolean> {
        if (!this.oauth2Client) {
            throw new Error('Google Drive Client ID and Secret not configured.');
        }

        return new Promise((resolve, reject) => {
            const authUrl = this.oauth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: ['https://www.googleapis.com/auth/drive.file'],
            });

            const server = http.createServer(async (req, res) => {
                try {
                    if (req.url!.indexOf('/oauth2callback') > -1) {
                        const qs = new url.URL(req.url!, 'http://localhost:3000').searchParams;
                        const code = qs.get('code');

                        res.end('Authentication successful! You can close this window.');
                        server.close();

                        if (code) {
                            const { tokens } = await this.oauth2Client.getToken(code);
                            this.setCredentials(tokens);
                            resolve(true);
                        } else {
                            reject(new Error('No code found'));
                        }
                    }
                } catch (e) {
                    reject(e);
                }
            });

            server.on('error', (e: any) => {
                if (e.code === 'EADDRINUSE') {
                    reject(new Error('Port 3000 is occupied. Please stop other processes (like dev servers) on port 3000.'));
                } else {
                    reject(e);
                }
            });

            server.listen(3000, () => {
                // Open the auth URL in the default browser (loopback)
                require('electron').shell.openExternal(authUrl);
            });

            // Timeout after 60 seconds to prevent infinite loading
            const timeout = setTimeout(() => {
                server.close();
                reject(new Error('Authentication timed out. Please try again.'));
            }, 60000);

            // Allow server to close and clear timeout on success
            const originalClose = server.close.bind(server);
            server.close = (cb?: (err?: Error) => void) => {
                clearTimeout(timeout);
                return originalClose(cb);
            };
        });
    }

    private async getOrCreateBackupFolder(): Promise<string> {
        if (!this.tokens) throw new Error('Not authenticated');

        // Check if folder exists
        const q = "mimeType = 'application/vnd.google-apps.folder' and name = 'NalamDesk Backups' and trashed = false";
        const res = await this.drive.files.list({
            q: q,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        if (res.data.files && res.data.files.length > 0) {
            return res.data.files[0].id;
        }

        // Create folder if not exists
        const fileMetadata = {
            name: 'NalamDesk Backups',
            mimeType: 'application/vnd.google-apps.folder'
        };

        const folder = await this.drive.files.create({
            requestBody: fileMetadata,
            fields: 'id'
        });

        return folder.data.id;
    }

    async uploadFile(filePath: string, name: string) {
        if (!this.tokens) throw new Error('Not authenticated');

        if (!this.tokens) throw new Error('Not authenticated');

        // Ensure token is valid/refreshed
        await this.oauth2Client.getAccessToken();

        const folderId = await this.getOrCreateBackupFolder();

        const fileMetadata = {
            name: name,
            parents: [folderId]
        };

        const media = {
            mimeType: 'application/x-sqlite3',
            body: fs.createReadStream(filePath)
        };

        const res = await this.drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id'
        });

        return res.data;
    }

    async listBackups() {
        if (!this.tokens) throw new Error('Not authenticated');

        // We need to find the folder first to list its contents
        // Optimization: We could store folderId in settings, but for now lookup is safer
        try {
            const folderId = await this.getOrCreateBackupFolder();

            const res = await this.drive.files.list({
                q: `'${folderId}' in parents and trashed = false`,
                fields: 'files(id, name, createdTime, size)',
                orderBy: 'createdTime desc'
            });

            return res.data.files;
        } catch (e) {
            console.error('Error listing backups:', e);
            return [];
        }
    }

    async downloadFile(fileId: string, destPath: string) {
        if (!this.tokens) throw new Error('Not authenticated');

        const dest = fs.createWriteStream(destPath);
        const res = await this.drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'stream' }
        );

        return new Promise((resolve, reject) => {
            res.data
                .on('end', () => {
                    resolve(true);
                })
                .on('error', (err: any) => {
                    reject(err);
                })
                .pipe(dest);
        });
    }
}
