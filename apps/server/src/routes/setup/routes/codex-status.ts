/**
 * GET /codex-status endpoint - Get Codex CLI installation and auth status
 */

import type { Request, Response } from 'express';
import { CodexProvider } from '../../../providers/codex-provider.js';
import { getErrorMessage, logError } from '../common.js';
import * as fs from 'fs';
import * as path from 'path';

const DISCONNECTED_MARKER_FILE = '.codex-disconnected';

function isCodexDisconnectedFromApp(): boolean {
  try {
    const projectRoot = process.cwd();
    const markerPath = path.join(projectRoot, '.automaker', DISCONNECTED_MARKER_FILE);
    return fs.existsSync(markerPath);
  } catch {
    return false;
  }
}

/**
 * Creates handler for GET /api/setup/codex-status
 * Returns Codex CLI installation and authentication status
 */
export function createCodexStatusHandler() {
  const installCommand = 'npm install -g @openai/codex';
  const loginCommand = 'codex login';

  return async (_req: Request, res: Response): Promise<void> => {
    try {
      // Check if user has manually disconnected from the app
      if (isCodexDisconnectedFromApp()) {
        res.json({
          success: true,
          installed: true,
          version: null,
          path: null,
          auth: {
            authenticated: false,
            method: 'none',
            hasApiKey: false,
          },
          installCommand,
          loginCommand,
        });
        return;
      }

      const provider = new CodexProvider();
      const status = await provider.detectInstallation();

      // Derive auth method from authenticated status and API key presence
      let authMethod = 'none';
      if (status.authenticated) {
        authMethod = status.hasApiKey ? 'api_key_env' : 'cli_authenticated';
      }

      res.json({
        success: true,
        installed: status.installed,
        version: status.version || null,
        path: status.path || null,
        auth: {
          authenticated: status.authenticated || false,
          method: authMethod,
          hasApiKey: status.hasApiKey || false,
        },
        installCommand,
        loginCommand,
      });
    } catch (error) {
      logError(error, 'Get Codex status failed');
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
      });
    }
  };
}
