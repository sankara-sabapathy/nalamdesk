---
sidebar_position: 3
---

# Architecture Overview

NalamDesk is built using a modern, hybrid desktop application architecture.

## Tech Stack

- **Electron**: Provides the desktop runtime environment.
- **Angular**: Powers the frontend user interface.
- **Fastify**: Runs a local background server for API handling and IPC.
- **SQLite**: Embedded database for local storage.

## Core Components

### 1. Main Process (Electron)
The entry point of the application (`src/main/main.ts`). It manages the application lifecycle, creates windows, and handles system-level integrations.

### 2. Renderer Process (Angular)
The user interface (`src/app`). It communicates with the backend via HTTP requests to the local Fastify server.

### 3. Local API Server (Fastify)
A Fastify server instance running locally (Port 3000) within the Electron app. It serves as the bridge between the frontend and the database (`src/main/server.ts`).

- **Authentication**: JWT-based authentication.
- **IPC**: Proxies requests to the `DatabaseService`.

### 4. Database Layer
Uses **better-sqlite3-multiple-ciphers** for secure, encrypted local data storage (`src/main/services/DatabaseService.ts`).

## Data Flow

1.  User performs an action in the Angular UI.
2.  Angular Service makes a HTTP POST request to `http://localhost:3000/api/ipc/:method`.
3.  Fastify Server intercepts the request, validates the JWT, and calls the corresponding method in `DatabaseService`.
4.  `DatabaseService` executes the SQL query against `nalamdesk.db`.
5.  Results are returned to the frontend.
