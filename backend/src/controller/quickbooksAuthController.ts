// controllers/quickbooksAuthController.ts

import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/responseHandler';
import quickbooksAuthService from '../service/quickbooksAuthService';
import { getStatusCode } from '../utils/errorHandler';

const qboConnect = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { returnUrl } = req.query as { returnUrl?: string };

        // Generate QuickBooks authorization URL
        const authData = quickbooksAuthService.getAuthorizationUrl(returnUrl);

        if (!authData || !authData.authUrl) {
            return sendError(
                res,
                'Failed to generate QuickBooks authorization URL',
                null,
                500
            );
        }

        // SUCCESS RESPONSE
        return sendSuccess(
            res,
            'QuickBooks authorization URL generated successfully',
            {
                authUrl: authData.authUrl,
                state: authData.state,
                message: 'Redirect user to this URL to begin QuickBooks authentication'
            }
        );
    } catch (error) {
        console.error('Error generating QuickBooks auth URL:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to generate QuickBooks authorization URL',
            { error: error instanceof Error ? error.message : 'Unknown error' },
            statusCode
        );
    }
};


const qboCallback = async (req: Request, res: Response): Promise<Response | void> => {
    try {
        const { code, state, realmId } = req.query;

        console.log('OAuth Callback received:', { 
            code: code ? 'present' : 'missing', 
            state: state ? 'present' : 'missing', 
            realmId: realmId ? realmId : 'missing',
            allParams: req.query 
        });

        // Validate required parameters
        if (!code) {
            console.error('Missing authorization code in callback');
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/?error=missing_code`);
        }

        if (!realmId) {
            console.error('Missing realmId in callback');
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/?error=missing_realm_id`);
        }

        if (!state) {
            console.error('Missing state in callback');
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/?error=missing_state`);
        }

        // Process the callback
        const connection = await quickbooksAuthService.processCallback(
            code as string,
            realmId as string,
            state as string
        );

        if (!connection) {
            console.error('Failed to process callback - no connection returned');
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/?error=callback_failed`);
        }

        console.log('Connection successful:', {
            connectionId: connection.id,
            realmId: connection.realmId,
            companyName: connection.companyName
        });

        // Success - redirect to frontend with success parameters
        // IMPORTANT: Use 'qb_' prefix to match frontend expectations
        const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/oauth-success?` +
            `qb_access_token=${encodeURIComponent(connection.accessToken)}&` +
            `qb_realm_id=${encodeURIComponent(connection.realmId)}&` +
            `qb_connection_id=${encodeURIComponent(connection.id)}&` +
            `qb_company_name=${encodeURIComponent(connection.companyName || 'Unknown Company')}`;

        console.log('Redirecting to:', frontendUrl);
        return res.redirect(frontendUrl);

    } catch (error) {
        console.error('Error handling QuickBooks OAuth callback:', error);

        // Redirect to frontend with error
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return res.redirect(
            `${process.env.FRONTEND_URL || 'http://localhost:5173'}/?error=${encodeURIComponent(errorMessage)}`
        );
    }
};

const qboStatus = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { connectionId } = req.params;

        // Validate required parameters
        if (!connectionId) {
            return sendError(res, 'Connection ID is required', null, 400);
        }

        // Get connection status
        const connection = await quickbooksAuthService.getConnectionStatus(connectionId);

        if (!connection) {
            return sendError(res, 'Connection not found', null, 404);
        }

        // Check if token is expired and needs refresh
        const now = new Date();
        const isTokenExpired = now >= connection.expiresAt;
        const isRefreshTokenExpired = now >= connection.refreshExpiresAt;

        // SUCCESS RESPONSE
        return sendSuccess(
            res,
            'QuickBooks connection status retrieved successfully',
            {
                connection: {
                    id: connection.id,
                    realmId: connection.realmId,
                    companyName: connection.companyName,
                    isConnected: connection.isConnected,
                    connectedAt: connection.connectedAt,
                    lastSyncAt: connection.lastSyncAt,
                    expiresAt: connection.expiresAt,
                    refreshExpiresAt: connection.refreshExpiresAt
                },
                tokenStatus: {
                    isTokenExpired,
                    isRefreshTokenExpired,
                    needsRefresh: isTokenExpired && !isRefreshTokenExpired,
                    needsReauth: isRefreshTokenExpired
                }
            }
        );
    } catch (error) {
        console.error('Error getting connection status:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to get connection status',
            { 
                error: error instanceof Error ? error.message : 'Unknown error',
                connectionId: req.params?.connectionId
            },
            statusCode
        );
    }
};

const qboRefresh = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { connectionId } = req.body;

        if (!connectionId) {
            return sendError(res, 'Connection ID is required', null, 400);
        }

        const connection = await quickbooksAuthService.refreshToken(connectionId);

        return sendSuccess(res, 'Access token refreshed successfully', {
            connection: {
                id: connection.id,
                realmId: connection.realmId,
                companyName: connection.companyName,
                expiresAt: connection.expiresAt,
                refreshExpiresAt: connection.refreshExpiresAt
            }
        });
    } catch (error) {
        console.error('Error refreshing QuickBooks token:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to refresh access token',
            { error: error instanceof Error ? error.message : 'Unknown error' },
            statusCode
        );
    }
};


const qboDisconnect = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { connectionId } = req.body;

        if (!connectionId) {
            return sendError(res, 'Connection ID is required', null, 400);
        }

        // Disconnect integration (this handles token revocation internally)
        await quickbooksAuthService.disconnectIntegration(connectionId);

        return sendSuccess(res, 'Successfully disconnected from QuickBooks', {
            connectionId,
            message: 'QuickBooks connection has been revoked. All tokens have been invalidated.'
        });
    } catch (error) {
        console.error('Error disconnecting from QuickBooks:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to disconnect from QuickBooks',
            { error: error instanceof Error ? error.message : 'Unknown error' },
            statusCode
        );
    }
};

const qboConnections = async (req: Request, res: Response): Promise<Response> => {
    try {
        const connections = await quickbooksAuthService.getActiveConnections();

        const connectionsWithStatus = connections.map(connection => {
            const now = new Date();
            const isTokenExpired = now >= connection.expiresAt;
            const isRefreshTokenExpired = now >= connection.refreshExpiresAt;

            return {
                id: connection.id,
                realmId: connection.realmId,
                companyName: connection.companyName,
                isConnected: connection.isConnected,
                connectedAt: connection.connectedAt,
                lastSyncAt: connection.lastSyncAt,
                expiresAt: connection.expiresAt,
                tokenStatus: {
                    isTokenExpired,
                    isRefreshTokenExpired,
                    needsRefresh: isTokenExpired && !isRefreshTokenExpired,
                    needsReauth: isRefreshTokenExpired
                }
            };
        });

        return sendSuccess(res, 'Active connections retrieved successfully', {
            connections: connectionsWithStatus,
            totalConnections: connectionsWithStatus.length
        });

    } catch (error) {
        console.error('Error getting active connections:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to get active connections',
            { error: error instanceof Error ? error.message : 'Unknown error' },
            statusCode
        );
    }
};


const qboTestConnection = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { connectionId } = req.params;

        if (!connectionId) {
            return sendError(res, 'Connection ID is required', null, 400);
        }

        const connection = await quickbooksAuthService.getConnectionStatus(connectionId);

        if (!connection) {
            return sendError(res, 'Connection not found', null, 404);
        }

        if (!connection.isConnected) {
            return sendError(res, 'Connection is not active', null, 400);
        }

        // Test the connection
        const testResult = await quickbooksAuthService.testConnection(connectionId);

        if (!testResult.isValid) {
            return sendError(res, 'Connection test failed', {
                connectionId,
                status: 'Connection is not working properly'
            }, 400);
        }

        return sendSuccess(res, 'Connection test completed successfully', {
            connection: {
                id: connection.id,
                realmId: connection.realmId,
                companyName: testResult.companyName || connection.companyName,
                isConnected: connection.isConnected,
                status: 'Connection is active and working'
            }
        });

    } catch (error) {
        console.error('Error testing connection:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Connection test failed',
            { error: error instanceof Error ? error.message : 'Unknown error' },
            statusCode
        );
    }
};

// Export all controller functions
const quickbooksAuthController = {
    qboConnect,
    qboCallback,
    qboStatus,
    qboRefresh,
    qboDisconnect,
    qboConnections,
    qboTestConnection
};

export { quickbooksAuthController };