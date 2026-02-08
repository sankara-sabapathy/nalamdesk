# Google Drive Backup Setup Guide ☁️

For self-hosted installations of NalamDesk, you need to configure your own **Google Cloud Project** to enable Google Drive backups. This ensures you have full control over your data and API usage quotas.

## Why do I need this?
Google requires an **OAuth 2.0 Client ID** and **Client Secret** to authorize third-party applications (like NalamDesk) to access your Google Drive. Since NalamDesk is open-source, these secrets cannot be embedded in the application code securely. You are the owner of the application instance.

## Prerequisites
- A Google Account (Gmail or Workspace).
- Access to the [Google Cloud Console](https://console.cloud.google.com/).

## Step 1: Create a Project
1.  Go to the **[Google Cloud Console](https://console.cloud.google.com/)**.
2.  Click the project dropdown in the top bar and select **New Project**.
3.  Name it `NalamDesk-Backup` (or similar).
4.  Click **Create**.

## Step 2: Enable Google Drive API
1.  In the sidebar, go to **APIs & Services > Library**.
2.  Search for `Google Drive API`.
3.  Click on it and select **Enable**.

## Step 3: Configure OAuth Consent Screen
1.  Go to **APIs & Services > OAuth consent screen**.
2.  Select **External** (for personal @gmail.com accounts) and click **Create**.
    - *Note: In "External" mode, the app will be in "Testing" status. You must add your own email as a Test User.*
3.  **App Information**:
    - App name: `NalamDesk Backup`
    - User support email: Your email.
    - Developer contact information: Your email.
4.  Click **Save and Continue** until you reach **Test Users**.
5.  **Test Users**: Click **+ Add Users** and enter your google email address. This authorizes *you* to use your own app.
6.  Click **Save and Continue**.

## Step 4: Create Credentials
1.  Go to **APIs & Services > Credentials**.
2.  Click **+ Create Credentials** and select **OAuth client ID**.
3.  **Application type**: Select **Desktop app**.
4.  **Name**: `Desktop Client`.
5.  Click **Create**.

## Step 5: Configure NalamDesk
1.  You will see a dialog with your **Client ID** and **Client Secret**.
2.  Copy these strings.
3.  Open NalamDesk Settings > **Data & Backup**.
4.  Enter the Client ID and Client Secret in the respective fields.
5.  Click **Connect Drive**.

> **Security Note**: Your Client Secret is stored locally in your encrypted `nalamdesk.db` database. Never share these credentials.
