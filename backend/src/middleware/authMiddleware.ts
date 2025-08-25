// middleware/quickbooksAuthMiddleware.ts

import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      qbAuth?: {
        accessToken: string;
        realmId: string;
      };
    }
  }
}

/**
 * Middleware to validate QuickBooks authentication headers
 * Expects Authorization: Bearer <token> and realm-id: <realmId> headers
 */
export const quickbooksAuthMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    const realmId = req.headers['realm-id'] as string;

    // Extract access token from Authorization header
    const accessToken = authHeader?.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : undefined;

    // Validate required headers
    if (!accessToken) {
      res.status(401).json({
        status: 'error',
        message: 'Missing or invalid Authorization header. Expected format: Bearer <token>',
        data: null
      });
      return;
    }

    if (!realmId) {
      res.status(401).json({
        status: 'error',
        message: 'Missing realm-id header',
        data: null
      });
      return;
    }

    // Validate token format (basic validation)
    if (typeof accessToken !== 'string' || accessToken.length < 10) {
      res.status(401).json({
        status: 'error',
        message: 'Invalid access token format',
        data: null
      });
      return;
    }

    // Validate realmId format (basic validation)
    if (typeof realmId !== 'string' || realmId.length < 5) {
      res.status(401).json({
        status: 'error',
        message: 'Invalid realm ID format',
        data: null
      });
      return;
    }

    // Attach auth info to request object
    req.qbAuth = {
      accessToken,
      realmId
    };

    next();
  } catch (error) {
    console.error('QuickBooks auth middleware error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error during authentication',
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    });
  }
};

/**
 * Optional middleware for additional token validation
 * This can be extended to check token expiry, make test API calls, etc.
 */
export const quickbooksTokenValidationMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { accessToken, realmId } = req.qbAuth!;

    // Here you could add additional validation like:
    // - Check if token is expired
    // - Make a test API call to verify token is still valid
    // - Check database for connection status
    // - Validate realmId exists in your system

    // For now, we'll just proceed
    next();
  } catch (error) {
    console.error('QuickBooks token validation error:', error);
    res.status(401).json({
      status: 'error',
      message: 'Token validation failed',
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    });
  }
};