import { google } from 'googleapis';
import * as http from 'http';
import * as url from 'url';
import { BrowserWindow } from 'electron';
import * as fs from 'fs';

// Placeholder credentials - User should replace these or inject via env
const CLIENT_ID = 'YOUR_CLIENT_ID';
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET';
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

export class GoogleDriveService {
    private oauth2Client;
    private drive;
    private tokens: any = null;

    constructor() {
        this.oauth2Client = new google.auth.OAuth2(
            CLIENT_ID,
            CLIENT_SECRET,
            REDIRECT_URI
        );

        this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
    }

    setCredentials(tokens: any) {
        this.tokens = tokens;
        this.oauth2Client.setCredentials(tokens);
    }

    getCredentials() {
        return this.tokens;
    }

    isAuthenticated(): boolean {
        return !!this.tokens;
    }

    async authenticate(mainWindow: BrowserWindow): Promise<boolean> {
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

            server.listen(3000, () => {
                // Open the auth URL in the default browser (loopback)
                require('electron').shell.openExternal(authUrl);
            });
        });
    }

    async uploadFile(filePath: string, name: string) {
        if (!this.tokens) throw new Error('Not authenticated');

        const fileMetadata = {
            name: name,
            parents: ['appDataFolder'] // Upload to hidden app folder
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

        const res = await this.drive.files.list({
            q: "parents in 'appDataFolder' and trashed = false",
            fields: 'files(id, name, createdTime, size)',
            orderBy: 'createdTime desc'
        });

        return res.data.files;
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
                .on('error', (err) => {
                    reject(err);
                })
                .pipe(dest);
        });
    }
}
