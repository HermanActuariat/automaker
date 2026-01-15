/**
 * POST /auth-cursor endpoint - Authenticate Cursor CLI
 */

import type { Request, Response } from 'express';
import { logError, getErrorMessage } from '../common.js';
import * as fs from 'fs';
import * as path from 'path';
import os from 'os';

export function createAuthCursorHandler() {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      // Remove the disconnected marker file to reconnect the app to the CLI
      const markerPath = path.join(process.cwd(), '.automaker', '.cursor-disconnected');
      if (fs.existsSync(markerPath)) {
        fs.unlinkSync(markerPath);
      }

      // Check if Cursor is already authenticated using the same logic as CursorProvider
      const isAlreadyAuthenticated = (): boolean => {
        // Check for API key in environment
        if (process.env.CURSOR_API_KEY) {
          return true;
        }

        // Check for credentials files
        const credentialPaths = [
          path.join(os.homedir(), '.cursor', 'credentials.json'),
          path.join(os.homedir(), '.config', 'cursor', 'credentials.json'),
        ];

        for (const credPath of credentialPaths) {
          if (fs.existsSync(credPath)) {
            try {
              const content = fs.readFileSync(credPath, 'utf8');
              const creds = JSON.parse(content);
              if (creds.accessToken || creds.token) {
                return true;
              }
            } catch {
              // Invalid credentials file, continue checking
            }
          }
        }

        return false;
      };

      if (isAlreadyAuthenticated()) {
        res.json({
          success: true,
          message: 'Cursor CLI is now linked with the app',
          wasAlreadyAuthenticated: true,
        });
      } else {
        res.json({
          success: true,
          message:
            'Cursor CLI is now linked with the app. If prompted, please authenticate with "cursor auth" in your terminal.',
          requiresManualAuth: true,
        });
      }
    } catch (error) {
      logError(error, 'Auth Cursor failed');
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
        message: 'Failed to link Cursor CLI with the app',
      });
    }
  };
}
