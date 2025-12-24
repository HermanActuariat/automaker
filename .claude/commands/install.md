---
description: Install all dependencies, build packages, and optionally run the Automaker app.
allowed-tools: Bash, Read, AskUserQuestion
---

# Install

Install all dependencies, build packages, and optionally launch the Automaker application.

## Prerequisites

- Node.js (v18 or higher recommended)
- npm (comes with Node.js)

## Workflow

1. **Check Node.js and npm availability**

   ```bash
   node --version
   npm --version
   ```

   If either command fails, inform the user they need to install Node.js first.

2. **Install npm dependencies**
   Run from the project root directory:

   ```bash
   npm install
   ```

   This will:
   - Install all workspace dependencies (apps/ui, apps/server, libs/\*)
   - Run postinstall scripts (fixes for node-pty on macOS)
   - Set up husky git hooks

3. **Build all packages**
   Build the shared libraries in the correct order:

   ```bash
   npm run build:packages
   ```

   This builds libs in dependency order: types -> platform -> utils -> prompts, model-resolver, dependency-resolver -> git-utils

4. **Ask user what to do next**
   Use AskUserQuestion to ask the user what they want to do:
   - Run the web application (browser-based)
   - Run the desktop application (Electron)
   - Just finish installation (don't run anything)

5. **Launch the application (if requested)**
   Based on user choice:

   **For Web Application:**

   ```bash
   npm run dev:full
   ```

   This starts both the backend server (port 3008) and the web UI (port 3007).

   **For Desktop Application:**

   ```bash
   npm run dev:electron
   ```

   This starts the Electron app with its bundled backend.

   **For just installation:**
   Skip launching and report success.

## Report Format

After completion, provide a summary:

```
Installation Complete!

Dependencies: Installed
Packages Built: Yes
Application: <Running on http://localhost:3007 | Running in Electron | Not started>

Available commands:
- npm run dev          - Interactive launcher (choose web or electron)
- npm run dev:full     - Web app + server
- npm run dev:electron - Desktop app
- npm run build        - Production build
- npm run test         - Run tests
```

## Error Handling

- If `npm install` fails, check for:
  - Network issues
  - Node.js version compatibility
  - Permission issues
- If build fails, try cleaning and reinstalling:
  ```bash
  rm -rf node_modules
  npm install
  npm run build:packages
  ```
- If ports 3007 or 3008 are in use, the init script will attempt to free them automatically
