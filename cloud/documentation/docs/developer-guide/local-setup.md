---
sidebar_position: 2
---

# Setup Guide

This guide describes how to set up the NalamDesk development environment.

## Prerequisites

- **Node.js**: Version 18 or higher.
- **npm**: Included with Node.js.
- **Git**: For version control.

## Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/sankara-sabapathy/nalamdesk.git
    cd nalamdesk
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Install Application Dependencies:**
    
    The application uses Electron, Angular, and native modules (better-sqlite3, argon2).
    
    *   **Windows**: Requires [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (Desktop development with C++) and Python 3.
    *   **macOS**: Requires Xcode Command Line Tools (`xcode-select --install`) and Python 3.
    *   **Linux**: Requires `build-essential` and Python 3.

    `npm install` will automatically attempt to build these. `npm run postinstall` can be run manually if automatic scripts are disabled.
    ```bash
    npm run postinstall
    ```

## Running the Application

To start the application in development mode:

```bash
npm start
```

This command will:
- Start the Angular development server.
- Compile the Electron main process.
- Launch the Electron application window.

## Building for Production

To build the application for your OS:

- **Windows:** `npm run dist:win`
- **Linux:** `npm run dist:linux`
- **Mac:** `npm run dist:mac`
