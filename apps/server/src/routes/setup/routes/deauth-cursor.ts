/**
 * POST /deauth-cursor endpoint - Sign out from Cursor CLI
 */

import type { Request, Response } from 'express';
import { logError, getErrorMessage } from '../common.js';
import * as fs from 'fs';
import * as path from 'path';

export function createDeauthCursorHandler() {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      // Create a marker file to indicate the CLI is disconnected from the app
      const automakerDir = path.join(process.cwd(), '.automaker');
      const markerPath = path.join(automakerDir, '.cursor-disconnected');

      // Ensure .automaker directory exists
      if (!fs.existsSync(automakerDir)) {
        fs.mkdirSync(automakerDir, { recursive: true });
      }

      // Create the marker file with timestamp
      fs.writeFileSync(
        markerPath,
        JSON.stringify({
          disconnectedAt: new Date().toISOString(),
          message: 'Cursor CLI is disconnected from the app',
        })
      );

      res.json({
        success: true,
        message: 'Cursor CLI is now disconnected from the app',
      });
    } catch (error) {
      logError(error, 'Deauth Cursor failed');
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
        message: 'Failed to disconnect Cursor CLI from the app',
      });
    }
  };
}
