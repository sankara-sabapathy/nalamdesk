# Why WhatsApp doesn't ask for Client ID/Secret?

1.  **Closed Source vs. Open Source**:
    - **WhatsApp** is a proprietary, closed-source application. They **embed** their Client ID and Secret deep inside their compiled application code (APK/IPA).
    - Because the source code is not public, it is "harder" (though not impossible) for attackers to extract these secrets.
    - **NalamDesk** is open-source. If we committed our Client Secret to GitHub, **anyone** could see it and use it to impersonate our app, leading to Google banning our API access immediately.

2.  **Verified Publisher Trust**:
    - Meta (Facebook) is a verified publisher with Google. They assume liability for how their embedded secret is used.
    - As an open-source project, we cannot assume liability for every self-hosted instance.

## The Open Source Standard
Tools like **rclone**, **Duplicati**, and others that integrate with Google Drive often follow this **"Bring Your Own Key"** model for the same security reasons. It gives *you* (the user) complete control and ensures your data isn't dependent on a developer's API quota or standing.
