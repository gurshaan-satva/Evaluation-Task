// services/chartOfAccountsService.ts - Updated with connection lookup

import axios from 'axios';
import { prisma } from '../config/db';
import { ChartOfAccount } from '@prisma/client';
import { QBOAccount, QBOQueryResponse } from '../types/chartOfAccounts';

// Helper function to get API base URL
const getQboApiBaseUrl = (): string => {
    return process.env.ENVIRONMENT === 'production'
        ? 'https://quickbooks.api.intuit.com'
        : 'https://sandbox-quickbooks.api.intuit.com';
};


/**
 * Find or create QBO connection based on realmId
 */
const findOrCreateConnection = async (realmId: string, accessToken: string): Promise<string> => {
    try {
        // First, try to find existing connection by realmId
        let connection = await prisma.qBOConnection.findUnique({
            where: { realmId }
        });

        if (!connection) {
            // Create new connection if not found
            console.log(`Creating new QBO connection for realmId: ${realmId}`);
            connection = await prisma.qBOConnection.create({
                data: {
                    realmId,
                    accessToken,
                    refreshToken: '', // You might want to get this from somewhere
                    expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
                    refreshExpiresAt: new Date(Date.now() + 101 * 24 * 3600 * 1000), // 101 days from now
                    isConnected: true,
                    companyName: `Company-${realmId}`, // You can fetch this from QB API
                    connectedAt: new Date()
                }
            });
        } else if (!connection.isConnected) {
            // Reactivate connection if it was disconnected
            connection = await prisma.qBOConnection.update({
                where: { id: connection.id },
                data: {
                    accessToken,
                    isConnected: true,
                    connectedAt: new Date()
                }
            });
        }

        return connection.id;
    } catch (error) {
        console.error('Error finding/creating QBO connection:', error);
        throw new Error(`Failed to find or create QBO connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Sync Chart of Accounts from QuickBooks to database
 * Uses incremental sync based on last updated timestamp
 */
const syncChartOfAccounts = async (accessToken: string, realmId: string): Promise<{
    success: boolean;
    totalAccounts: number;
    created: number;
    updated: number;
    message: string;
}> => {
    try {
        // Find or create QBO connection
        const qboConnectionId = await findOrCreateConnection(realmId, accessToken);

        // 1. Find the most recently updated account in DB for this connection
        const latest = await prisma.chartOfAccount.findFirst({
            where: { qboConnectionId },
            orderBy: { updatedAtQB: 'desc' },
            select: { updatedAtQB: true },
        });

        // 2. Build dynamic query for incremental sync
        const query = latest?.updatedAtQB
            ? `SELECT * FROM Account WHERE MetaData.LastUpdatedTime > '${latest.updatedAtQB.toISOString()}'`
            : `SELECT * FROM Account`;

        console.log('Executing QuickBooks query:', query);

        // 3. Make API request to QuickBooks
        const baseUrl = getQboApiBaseUrl();
        const response = await axios.get<QBOQueryResponse>(
            `${baseUrl}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/json',
                },
            }
        );

        const accounts = response.data.QueryResponse.Account || [];
        console.log(`Fetched ${accounts.length} accounts from QuickBooks`);

        if (accounts.length === 0) {
            return {
                success: true,
                totalAccounts: 0,
                created: 0,
                updated: 0,
                message: 'No new or updated accounts found in QuickBooks'
            };
        }

        // 4. Save or update the records in the database
        let created = 0;
        let updated = 0;

        const upsertPromises = accounts.map(async (account: QBOAccount) => {
            const existingAccount = await prisma.chartOfAccount.findUnique({
                where: { id: account.Id }
            });

            const accountData = {
                name: account.Name,
                accountType: account.AccountType,
                accountSubType: account.AccountSubType || null,
                classification: account.Classification || null,
                currency: account.CurrencyRef?.value || null,
                currencyName: account.CurrencyRef?.name || null,
                currentBalance: account.CurrentBalance || null,
                currentBalanceWithSub: account.CurrentBalanceWithSubAccounts || null,
                active: account.Active ?? true,
                subAccount: account.SubAccount ?? false,
                syncToken: account.SyncToken,
                fullyQualifiedName: account.FullyQualifiedName,
                domain: account.domain,
                createdAtQB: account.MetaData?.CreateTime
                    ? new Date(account.MetaData.CreateTime)
                    : null,
                updatedAtQB: account.MetaData?.LastUpdatedTime
                    ? new Date(account.MetaData.LastUpdatedTime)
                    : null,
                qboConnectionId // Use the found/created connection ID
            };

            if (existingAccount) {
                // Update existing account
                await prisma.chartOfAccount.update({
                    where: { id: account.Id },
                    data: {
                        ...accountData,
                        updatedAt: new Date()
                    }
                });
                updated++;
            } else {
                // Create new account
                await prisma.chartOfAccount.create({
                    data: {
                        id: account.Id,
                        ...accountData,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                });
                created++;
            }
        });

        await Promise.all(upsertPromises);

        // Update connection's last sync timestamp
        await prisma.qBOConnection.update({
            where: { id: qboConnectionId },
            data: { lastSyncAt: new Date() }
        });

        const message = `${accounts.length} account(s) synced successfully: ${created} created, ${updated} updated`;
        console.log(message);

        return {
            success: true,
            totalAccounts: accounts.length,
            created,
            updated,
            message
        };

    } catch (error) {
        console.error('Error syncing Chart of Accounts:', error);
        
        if (axios.isAxiosError(error)) {
            const qbError = error.response?.data;
            console.error('QuickBooks API Error:', JSON.stringify(qbError, null, 2));
            
            if (error.response?.status === 401) {
                throw new Error('Authentication failed - token may be expired or invalid');
            }
            if (error.response?.status === 403) {
                throw new Error('Access forbidden - insufficient permissions');
            }
            throw new Error(`QuickBooks API error: ${qbError?.Fault?.Error?.[0]?.Detail || error.message}`);
        }

        throw new Error(`Chart of Accounts sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Get Chart of Accounts from database with pagination and filtering
 */
const getChartOfAccounts = async (options: {
    page?: number;
    limit?: number;
    search?: string;
    accountType?: string;
    active?: boolean;
    realmId?: string;
} = {}): Promise<{
    accounts: ChartOfAccount[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
}> => {
    try {
        const page = options.page || 1;
        const limit = Math.min(options.limit || 50, 100); // Max 100 per page
        const skip = (page - 1) * limit;

        // Build where clause
        const where: any = {};

        // Filter by realmId if provided
        if (options.realmId) {
            const connection = await prisma.qBOConnection.findUnique({
                where: { realmId: options.realmId }
            });
            if (connection) {
                where.qboConnectionId = connection.id;
            }
        }

        if (options.search) {
            where.OR = [
                { name: { contains: options.search, mode: 'insensitive' } },
                { fullyQualifiedName: { contains: options.search, mode: 'insensitive' } }
            ];
        }

        if (options.accountType) {
            where.accountType = options.accountType;
        }

        if (options.active !== undefined) {
            where.active = options.active;
        }

        // Get total count
        const totalCount = await prisma.chartOfAccount.count({ where });

        // Get accounts with pagination
        const accounts = await prisma.chartOfAccount.findMany({
            where,
            orderBy: { fullyQualifiedName: 'asc' },
            skip,
            take: limit
        });

        const totalPages = Math.ceil(totalCount / limit);

        return {
            accounts,
            totalCount,
            totalPages,
            currentPage: page
        };
    } catch (error) {
        throw new Error(`Failed to fetch Chart of Accounts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Get Chart of Accounts statistics
 */
const getChartOfAccountsStats = async (realmId?: string): Promise<{
    totalAccounts: number;
    activeAccounts: number;
    inactiveAccounts: number;
    subAccounts: number;
    accountTypes: { [key: string]: number };
    accountSubTypes: { [key: string]: number };
    lastSyncTime: Date | null;
}> => {
    try {
        // Build where clause
        const where: any = {};
        if (realmId) {
            const connection = await prisma.qBOConnection.findUnique({
                where: { realmId }
            });
            if (connection) {
                where.qboConnectionId = connection.id;
            }
        }

        // Get all accounts
        const accounts = await prisma.chartOfAccount.findMany({
            where,
            select: {
                active: true,
                subAccount: true,
                accountType: true,
                accountSubType: true,
                updatedAtQB: true
            }
        });

        // Calculate statistics
        const stats = {
            totalAccounts: accounts.length,
            activeAccounts: accounts.filter(acc => acc.active).length,
            inactiveAccounts: accounts.filter(acc => !acc.active).length,
            subAccounts: accounts.filter(acc => acc.subAccount).length,
            accountTypes: {} as { [key: string]: number },
            accountSubTypes: {} as { [key: string]: number },
            lastSyncTime: null as Date | null
        };

        // Group by account types
        accounts.forEach(account => {
            stats.accountTypes[account.accountType] = (stats.accountTypes[account.accountType] || 0) + 1;
            
            if (account.accountSubType) {
                stats.accountSubTypes[account.accountSubType] = (stats.accountSubTypes[account.accountSubType] || 0) + 1;
            }
        });

        // Get last sync time
        const lastUpdated = await prisma.chartOfAccount.findFirst({
            where,
            orderBy: { updatedAt: 'desc' },
            select: { updatedAt: true }
        });

        stats.lastSyncTime = lastUpdated?.updatedAt || null;

        return stats;
    } catch (error) {
        throw new Error(`Failed to fetch Chart of Accounts statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Get distinct account types for filtering
 */
const getAccountTypes = async (realmId?: string): Promise<string[]> => {
    try {
        const where: any = {};
        if (realmId) {
            const connection = await prisma.qBOConnection.findUnique({
                where: { realmId }
            });
            if (connection) {
                where.qboConnectionId = connection.id;
            }
        }

        const types = await prisma.chartOfAccount.findMany({
            where,
            select: { accountType: true },
            distinct: ['accountType'],
            orderBy: { accountType: 'asc' }
        });

        return types.map(type => type.accountType);
    } catch (error) {
        throw new Error(`Failed to fetch account types: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

// Export service functions
const chartOfAccountsService = {
    syncChartOfAccounts,
    getChartOfAccounts,
    getChartOfAccountsStats,
    getAccountTypes
};

export default chartOfAccountsService;