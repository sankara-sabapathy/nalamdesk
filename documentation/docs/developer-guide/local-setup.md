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
    
    The application uses Electron, Angular, and other native modules. Ensure build tools are available.

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
