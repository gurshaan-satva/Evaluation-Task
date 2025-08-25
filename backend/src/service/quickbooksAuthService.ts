// services/quickbooksAuthService.ts

import axios from 'axios';
import { prisma } from '../config/db';
import { quickbooksConfig } from '../config/quickbooks';
import {
    QBOAuthTokenResponse,
    QBOTokenRefreshResponse,
    QBOAuthRequest,
    QBOConnectionData,
    QBOCompanyInfo,
    AuthState,
    QBOAuthUrl
} from '../types/quickbooks';

// Input validation helpers
const validateRealmId = (realmId: string): string => {
    if (!realmId || typeof realmId !== 'string') {
        throw new Error('Realm ID must be a valid string');
    }
    return realmId;
};

const validateAuthCode = (code: string): string => {
    if (!code || typeof code !== 'string') {
        throw new Error('Authorization code is required and must be a string');
    }
    return code;
};

const validateState = (state: string): AuthState => {
    if (!state) {
        throw new Error('State parameter is required');
    }

    try {
        const parsed = JSON.parse(Buffer.from(state, 'base64url').toString());
        const now = Date.now();
        const stateAge = now - parsed.timestamp;

        // State should not be older than 10 minutes
        if (stateAge > 10 * 60 * 1000) {
            throw new Error('State parameter has expired');
        }

        return parsed;
    } catch (error) {
        throw new Error('Invalid state parameter format');
    }
};

const validateConnectionId = (connectionId: string): string => {
    if (!connectionId || typeof connectionId !== 'string') {
        throw new Error('Connection ID must be a valid string');
    }
    return connectionId;
};

// Environment variables
const clientId = quickbooksConfig.clientId;
const clientSecret = quickbooksConfig.clientSecret;
const redirectUri = quickbooksConfig.redirectUri;
const tokenUrl = quickbooksConfig.tokenUrl;
const authUrl = quickbooksConfig.authUrl;

// Helper functions for environment-based URLs
const getQboApiBaseUrl = (): string => {
    return process.env.ENVIRONMENT === 'production'
        ? process.env.QBO_API_BASE_URL_PRODUCTION || process.env.API_BASE_URL || ''
        : process.env.QBO_API_BASE_URL_SANDBOX || process.env.API_BASE_URL || '';
};

const getRevokeUrl = (): string => {
    return process.env.ENVIRONMENT === 'production'
        ? 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke'
        : 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';
};

/**
 * Generate QuickBooks OAuth authorization URL
 */
const getAuthorizationUrl = (returnUrl?: string): QBOAuthUrl => {
    try {
        const state = generateState(returnUrl);
        const scopes = quickbooksConfig.scopes.join(' ');

        const authorizationUrl = `${authUrl}?` +
            `client_id=${clientId}&` +
            `scope=${encodeURIComponent(scopes)}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `response_type=code&` +
            `access_type=offline&` +
            `state=${state}`;

        return { authUrl: authorizationUrl, state };
    } catch (error) {
        throw new Error(`Failed to generate authorization URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Exchange authorization code for access and refresh tokens
 */
const exchangeCodeForTokens = async (code: string): Promise<QBOAuthTokenResponse> => {
    try {
        const validCode = validateAuthCode(code);

        const tokenPayload = new URLSearchParams({
            grant_type: 'authorization_code',
            code: validCode,
            redirect_uri: redirectUri
        });

        const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

        const response = await axios.post<QBOAuthTokenResponse>(tokenUrl, tokenPayload, {
            headers: {
                'Authorization': `Basic ${authHeader}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            }
        });

        const token = response.data;

        // Validate response structure
        if (!token.access_token || !token.refresh_token) {
            throw new Error('Invalid token response from QuickBooks');
        }

        return {
            access_token: token.access_token,
            refresh_token: token.refresh_token,
            expires_in: token.expires_in || 3600,
            refresh_token_expires_in: token.refresh_token_expires_in || 8726400, // 101 days default
            token_type: token.token_type || 'Bearer',
            x_refresh_token_expires_in: token.x_refresh_token_expires_in || token.refresh_token_expires_in || 8726400,
            realmId: token.realmId || ''
        };
    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 400) {
                throw new Error('Invalid authorization code or expired token');
            }
            if (error.response?.status === 401) {
                throw new Error('Authentication failed with QuickBooks');
            }
        }
        throw new Error(`Token exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Get company information from QuickBooks
 */
const getCompanyInfo = async (accessToken: string, realmId: string): Promise<QBOCompanyInfo> => {
    try {
        const baseUrl = getQboApiBaseUrl();
        const url = `${baseUrl}${realmId}/query?query=select * from CompanyInfo`;

        const response = await axios.get<QBOCompanyInfo>(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        return response.data;
    } catch (error) {
        console.error('Failed to fetch company info:', error);
        throw new Error(`Failed to fetch company information: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Validate integration constraints before saving connection
 */
const validateIntegrationConstraints = async (realmId: string): Promise<{ valid: boolean }> => {
    try {
        const validRealmId = validateRealmId(realmId);

        // Check if RealmId is already linked to another connection
        const existingConnection = await prisma.qBOConnection.findFirst({
            where: { 
                realmId: validRealmId,
                isConnected: true 
            }
        });

        if (existingConnection) {
            const error = new Error('This QuickBooks account is already connected.');
            error.name = 'REALM_ID_CONFLICT';
            throw error;
        }

        return { valid: true };
    } catch (error) {
        if (error instanceof Error && error.name === 'REALM_ID_CONFLICT') {
            throw error;
        }
        throw new Error(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Handle OAuth callback and exchange code for tokens
 */
const processCallback = async (code: string, realmId: string, state: string): Promise<QBOConnectionData> => {
    try {
        const validCode = validateAuthCode(code);
        const validRealmId = validateRealmId(realmId);
        const validatedState = validateState(state);

        // Validate business constraints first
        await validateIntegrationConstraints(validRealmId);

        // Exchange code for tokens
        const tokenData = await exchangeCodeForTokens(validCode);

        // Get company information
        const companyInfo = await getCompanyInfo(tokenData.access_token, validRealmId);

        // Save connection
        const connection = await saveConnection(tokenData, validRealmId, companyInfo);

        return connection;
    } catch (error) {
        console.error('Error processing callback:', error);
        throw new Error(error instanceof Error ? error.message : 'Callback processing failed');
    }
};

/**
 * Save connection to database
 */
const saveConnection = async (
    tokenData: QBOAuthTokenResponse,
    realmId: string,
    companyInfo: QBOCompanyInfo
): Promise<QBOConnectionData> => {
    try {
        const validRealmId = validateRealmId(realmId);

        if (!tokenData.access_token || !tokenData.refresh_token) {
            throw new Error('Invalid token data provided');
        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + (tokenData.expires_in * 1000));
        const refreshExpiresAt = new Date(
            now.getTime() + ((tokenData.refresh_token_expires_in ?? 8726400) * 1000)
        );

        const companyName = companyInfo.QueryResponse?.CompanyInfo?.[0]?.CompanyName || 'Unknown Company';

        const connection = await prisma.qBOConnection.upsert({
            where: { realmId: validRealmId },
            update: {
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token,
                expiresAt,
                refreshExpiresAt,
                isConnected: true,
                companyName,
                connectedAt: now,
                disconnectedAt: null
            },
            create: {
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token,
                realmId: validRealmId,
                expiresAt,
                refreshExpiresAt,
                isConnected: true,
                companyName,
                connectedAt: now
            }
        });

        return {
            id: connection.id,
            accessToken: connection.accessToken,
            refreshToken: connection.refreshToken,
            realmId: connection.realmId,
            expiresAt: connection.expiresAt,
            refreshExpiresAt: connection.refreshExpiresAt,
            isConnected: connection.isConnected,
            companyName: connection.companyName || undefined,
            connectedAt: connection.connectedAt,
            lastSyncAt: connection.lastSyncAt || undefined
        };
    } catch (error) {
        throw new Error(`Failed to save connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Refresh access token using refresh token
 */
/**
 * Refresh access token using refresh token
 */
export const refreshToken = async (connectionId: string): Promise<QBOConnectionData> => {
    try {
        const validConnectionId = validateConnectionId(connectionId);

        const connection = await prisma.qBOConnection.findUnique({
            where: { id: validConnectionId }
        });

        if (!connection) {
            throw new Error('Connection not found');
        }

        if (!connection.isConnected) {
            throw new Error('Connection is not active');
        }

        const tokenPayload = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: connection.refreshToken
        });

        const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

        const response = await axios.post<QBOTokenRefreshResponse>(tokenUrl, tokenPayload, {
            headers: {
                'Authorization': `Basic ${authHeader}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            }
        });

        const now = new Date();
        const expiresAt = new Date(now.getTime() + (response.data.expires_in * 1000));
        
        // Handle refresh token expiration calculation
        let refreshExpiresAt: Date;
        
        if (response.data.refresh_token_expires_in && 
            !isNaN(response.data.refresh_token_expires_in) && 
            response.data.refresh_token_expires_in > 0) {
            // Use the provided refresh token expiration time
            refreshExpiresAt = new Date(now.getTime() + (response.data.refresh_token_expires_in * 1000));
        } else if (response.data.x_refresh_token_expires_in && 
                   !isNaN(response.data.x_refresh_token_expires_in) && 
                   response.data.x_refresh_token_expires_in > 0) {
            // Some responses use x_refresh_token_expires_in instead
            refreshExpiresAt = new Date(now.getTime() + (response.data.x_refresh_token_expires_in * 1000));
        } else {
            // Fallback: QuickBooks refresh tokens are valid for 100 days (8,640,000 seconds)
            // But the token value changes every 24-26 hours
            const REFRESH_TOKEN_LIFETIME_SECONDS = 100 * 24 * 60 * 60; // 100 days in seconds
            refreshExpiresAt = new Date(now.getTime() + (REFRESH_TOKEN_LIFETIME_SECONDS * 1000));
            
            console.warn(`Refresh token expiration time not provided in response for connection ${connectionId}. Using fallback of 100 days.`);
        }

        // Validate the calculated dates
        if (isNaN(expiresAt.getTime())) {
            throw new Error('Invalid access token expiration time calculated');
        }
        
        if (isNaN(refreshExpiresAt.getTime())) {
            throw new Error('Invalid refresh token expiration time calculated');
        }

        // Update the connection with new tokens
        const updatedConnection = await prisma.qBOConnection.update({
            where: { id: validConnectionId },
            data: {
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token,
                expiresAt,
                refreshExpiresAt
            }
        });

        return {
            id: updatedConnection.id,
            accessToken: updatedConnection.accessToken,
            refreshToken: updatedConnection.refreshToken,
            realmId: updatedConnection.realmId,
            expiresAt: updatedConnection.expiresAt,
            refreshExpiresAt: updatedConnection.refreshExpiresAt,
            isConnected: updatedConnection.isConnected,
            companyName: updatedConnection.companyName || undefined,
            connectedAt: updatedConnection.connectedAt,
            lastSyncAt: updatedConnection.lastSyncAt || undefined
        };
    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 400) {
                throw new Error('Invalid or expired refresh token');
            }
            if (error.response?.status === 401) {
                throw new Error('Authentication failed while refreshing token');
            }
        }
        throw new Error(`Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Revoke tokens and disconnect from QuickBooks
 */
const revokeToken = async (refreshToken: string): Promise<void> => {
    try {
        if (!refreshToken || typeof refreshToken !== 'string') {
            throw new Error('Valid refresh token is required');
        }

        const revokeUrl = getRevokeUrl();
        const revokePayload = new URLSearchParams({
            token: refreshToken
        });

        const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

        await axios.post(revokeUrl, revokePayload, {
            headers: {
                'Authorization': `Basic ${authHeader}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 400) {
                throw new Error('Invalid or already revoked token');
            }
            if (error.response?.status === 401) {
                throw new Error('Authentication failed while revoking token');
            }
        }
        throw new Error(`Token revocation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Disconnect integration
 */
const disconnectIntegration = async (connectionId: string): Promise<void> => {
    try {
        const validConnectionId = validateConnectionId(connectionId);

        const connection = await prisma.qBOConnection.findUnique({
            where: { id: validConnectionId }
        });

        if (!connection) {
            throw new Error('Connection not found');
        }

        // Revoke refresh token if it exists
        if (connection.refreshToken) {
            try {
                await revokeToken(connection.refreshToken);
            } catch (err) {
                // Log but don't block disconnection if revocation fails
                console.warn(`Failed to revoke token for connection ${connectionId}:`, err);
            }
        }

        // Update connection status in database and remove tokens
        await prisma.qBOConnection.update({
            where: { id: validConnectionId },
            data: {
                isConnected: false,
                disconnectedAt: new Date(),
                accessToken: '', // Clear access token
                refreshToken: '' // Clear refresh token
            }
        });
    } catch (error) {
        throw new Error(`Failed to disconnect integration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Get connection status
 */
const getConnectionStatus = async (connectionId: string): Promise<QBOConnectionData | null> => {
    try {
        const validConnectionId = validateConnectionId(connectionId);

        const connection = await prisma.qBOConnection.findUnique({
            where: { id: validConnectionId }
        });

        if (!connection) {
            return null;
        }

        return {
            id: connection.id,
            accessToken: connection.accessToken,
            refreshToken: connection.refreshToken,
            realmId: connection.realmId,
            expiresAt: connection.expiresAt,
            refreshExpiresAt: connection.refreshExpiresAt,
            isConnected: connection.isConnected,
            companyName: connection.companyName || undefined,
            connectedAt: connection.connectedAt,
            lastSyncAt: connection.lastSyncAt || undefined
        };
    } catch (error) {
        throw new Error(`Failed to get connection status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Get all active connections
 */
const getActiveConnections = async (): Promise<QBOConnectionData[]> => {
    try {
        const connections = await prisma.qBOConnection.findMany({
            where: { isConnected: true }
        });

        return connections.map(connection => ({
            id: connection.id,
            accessToken: connection.accessToken,
            refreshToken: connection.refreshToken,
            realmId: connection.realmId,
            expiresAt: connection.expiresAt,
            refreshExpiresAt: connection.refreshExpiresAt,
            isConnected: connection.isConnected,
            companyName: connection.companyName || undefined,
            connectedAt: connection.connectedAt,
            lastSyncAt: connection.lastSyncAt || undefined
        }));
    } catch (error) {
        throw new Error(`Failed to get active connections: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Get valid access token (with auto-refresh)
 */
const getValidAccessToken = async (connectionId: string): Promise<string> => {
    try {
        const validConnectionId = validateConnectionId(connectionId);

        const connection = await prisma.qBOConnection.findFirst({
            where: { 
                id: validConnectionId,
                isConnected: true 
            }
        });

        if (!connection) {
            throw new Error('No active QuickBooks connection found');
        }

        const isExpired = !connection.expiresAt || new Date() >= new Date(connection.expiresAt);

        if (!isExpired) {
            return connection.accessToken;
        }

        // Refresh token if expired
        const refreshedConnection = await refreshToken(validConnectionId);
        return refreshedConnection.accessToken;
    } catch (error) {
        throw new Error(`Failed to get valid access token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Test connection by making a simple API call
 */
const testConnection = async (connectionId: string): Promise<{ isValid: boolean; companyName?: string }> => {
    try {
        const accessToken = await getValidAccessToken(connectionId);
        const connection = await getConnectionStatus(connectionId);

        if (!connection) {
            throw new Error('Connection not found');
        }

        // Test with a simple CompanyInfo query
        const companyInfo = await getCompanyInfo(accessToken, connection.realmId);
        const companyName = companyInfo.QueryResponse?.CompanyInfo?.[0]?.CompanyName;

        return {
            isValid: true,
            companyName
        };
    } catch (error) {
        console.error('Connection test failed:', error);
        return {
            isValid: false
        };
    }
};

/**
 * Generate state parameter for OAuth
 */
const generateState = (returnUrl?: string): string => {
    const state: AuthState = {
        timestamp: Date.now(),
        returnUrl
    };
    return Buffer.from(JSON.stringify(state)).toString('base64url');
};

// Main service object
const quickbooksAuthService = {
    getAuthorizationUrl,
    processCallback,
    refreshToken,
    disconnectIntegration,
    getConnectionStatus,
    getActiveConnections,
    getValidAccessToken,
    testConnection,
    saveConnection,
    revokeToken,
    getCompanyInfo
};

export default quickbooksAuthService;