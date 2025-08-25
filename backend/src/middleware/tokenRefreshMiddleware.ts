import { Request, Response, NextFunction } from 'express';
import { refreshToken } from '../service/quickbooksAuthService'; // Updated import to use the fixed function
import { prisma } from '../config/db';

// Token refresh middleware for QBO connections
export const qboTokenRefreshMiddleware = async (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  try {
    const realmId = req.headers['realm-id'] as string;
    
    if (!realmId) {
      return next(); // Skip middleware if no realm ID provided
    }

    // Find QBO connection by realmId
    const connection = await prisma.qBOConnection.findUnique({
      where: { realmId },
    });

    if (!connection || !connection.accessToken || !connection.refreshToken) {
      return next(); // Skip middleware if no connection or incomplete token data
    }

    if (!connection.isConnected) {
      return next(); // Skip if connection is not active
    }

    // Check if access token needs refresh (refresh when less than 10 minutes remaining)
    const currentTime = new Date();
    const timeRemaining = connection.expiresAt.getTime() - currentTime.getTime();
    const tenMinutesInMs = 10 * 60 * 1000;

    // Also check if refresh token itself is still valid
    const refreshTokenTimeRemaining = connection.refreshExpiresAt.getTime() - currentTime.getTime();
    
    if (refreshTokenTimeRemaining <= 0) {
      console.error(`Refresh token expired for connection ${connection.id}. Manual re-authentication required.`);
      // Mark connection as disconnected
      await prisma.qBOConnection.update({
        where: { id: connection.id },
        data: { 
          isConnected: false,
          disconnectedAt: currentTime
        }
      });
      return next(); // Continue with expired token - let the actual API call handle the error
    }

    // Refresh access token if less than 10 minutes remaining
    if (timeRemaining < tenMinutesInMs) {
      console.log(`Access token for connection ${connection.id} (realmId: ${connection.realmId}) is about to expire. Refreshing...`);
      
      try {
        // Use the fixed refresh token service
        const refreshedConnection = await refreshToken(connection.id);
        
        // Update the request headers with new access token for downstream use
        req.headers['authorization'] = `Bearer ${refreshedConnection.accessToken}`;
        
        // Add connection data to request for easy access
        (req as any).qboConnection = {
          id: refreshedConnection.id,
          realmId: refreshedConnection.realmId,
          accessToken: refreshedConnection.accessToken,
          companyName: refreshedConnection.companyName,
          isConnected: refreshedConnection.isConnected,
          expiresAt: refreshedConnection.expiresAt,
          refreshExpiresAt: refreshedConnection.refreshExpiresAt
        };
        
        console.log(`Token refreshed successfully for connection ${connection.id} (realmId: ${connection.realmId})`);
        console.log(`New token expires at: ${refreshedConnection.expiresAt}`);
        console.log(`Refresh token expires at: ${refreshedConnection.refreshExpiresAt}`);
        
      } catch (error) {
        console.error(`Failed to refresh token for connection ${connection.id}:`, error);
        
        // Handle specific refresh token errors
        if (error instanceof Error) {
          if (error.message.includes('Invalid or expired refresh token') || 
              error.message.includes('Authentication failed')) {
            // Mark connection as disconnected since refresh token is invalid
            await prisma.qBOConnection.update({
              where: { id: connection.id },
              data: { 
                isConnected: false,
                disconnectedAt: currentTime
              }
            });
            console.log(`Connection ${connection.id} marked as disconnected due to refresh token error: ${error.message}`);
          }
        }
        
        // Continue anyway - the request might still work with the existing token
        // or the downstream service can handle the authentication error
        return next();
      }
    } else {
      // Token is still valid, just add current token to headers and request object
      req.headers['authorization'] = `Bearer ${connection.accessToken}`;
      (req as any).qboConnection = {
        id: connection.id,
        realmId: connection.realmId,
        accessToken: connection.accessToken,
        companyName: connection.companyName,
        isConnected: connection.isConnected,
        expiresAt: connection.expiresAt,
        refreshExpiresAt: connection.refreshExpiresAt
      };
    }
    
    next();
  } catch (error) {
    console.error('Error in QBO token refresh middleware:', error);
    next(); // Proceed to the next middleware even if there's an error
  }
};

// Enhanced type extension for Request object to include QBO connection data
declare global {
  namespace Express {
    interface Request {
      qboConnection?: {
        id: string;
        realmId: string;
        accessToken: string;
        companyName?: string;
        isConnected: boolean;
        expiresAt: Date;
        refreshExpiresAt: Date;
      };
    }
  }
}