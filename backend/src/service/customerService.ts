// services/customerService.ts

import axios from 'axios';
import { prisma } from '../config/db';
import { Customer } from '@prisma/client';

// Helper function to get API base URL
const getQboApiBaseUrl = (): string => {
    return process.env.ENVIRONMENT === 'production'
        ? 'https://quickbooks.api.intuit.com'
        : 'https://sandbox-quickbooks.api.intuit.com';
};
import { QBOCustomer, QBOQueryResponse } from '../types/customer';

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
 * Sync Customers from QuickBooks to database
 * Uses incremental sync based on last updated timestamp
 */
const syncCustomers = async (accessToken: string, realmId: string): Promise<{
    success: boolean;
    totalCustomers: number;
    created: number;
    updated: number;
    message: string;
}> => {
    try {
        // Find or create QBO connection
        const qboConnectionId = await findOrCreateConnection(realmId, accessToken);

        // 1. Find the most recently updated customer in DB for this connection
        const latest = await prisma.customer.findFirst({
            where: { qboConnectionId },
            orderBy: { updatedAt: 'desc' },
            select: { updatedAt: true },
        });

        // 2. Build dynamic query for incremental sync
        const query = latest?.updatedAt
            ? `SELECT * FROM Customer WHERE MetaData.LastUpdatedTime > '${latest.updatedAt.toISOString()}'`
            : `SELECT * FROM Customer`;

        console.log('Executing QuickBooks Customer query:', query);

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

        const customers = response.data.QueryResponse.Customer || [];
        console.log(`Fetched ${customers.length} customers from QuickBooks`);

        if (customers.length === 0) {
            return {
                success: true,
                totalCustomers: 0,
                created: 0,
                updated: 0,
                message: 'No new or updated customers found in QuickBooks'
            };
        }

        // 4. Save or update the records in the database
        let created = 0;
        let updated = 0;

        const upsertPromises = customers.map(async (customer: QBOCustomer) => {
            const existingCustomer = await prisma.customer.findUnique({
                where: { id: customer.Id }
            });

            // Build billing address string from BillAddr object
            const billingLine1 = customer.BillAddr ? 
                [
                    customer.BillAddr.Line1,
                    customer.BillAddr.Line2,
                    customer.BillAddr.Line3,
                    customer.BillAddr.Line4,
                    customer.BillAddr.Line5
                ].filter(Boolean).join(', ') : null;

            const customerData = {
                displayName: customer.DisplayName || customer.Name,
                firstName: customer.GivenName || null,
                lastName: customer.FamilyName || null,
                email: customer.PrimaryEmailAddr?.Address || null,
                phone: customer.PrimaryPhone?.FreeFormNumber || null,
                billingLine1: billingLine1,
                city: customer.BillAddr?.City || null,
                state: customer.BillAddr?.CountrySubDivisionCode || null,
                postalCode: customer.BillAddr?.PostalCode || null,
                country: customer.BillAddr?.Country || null,
                syncToken: customer.SyncToken,
                balance: customer.Balance || null,
                active: customer.Active ?? true,
                qboConnectionId // Use the found/created connection ID
            };

            if (existingCustomer) {
                // Update existing customer
                await prisma.customer.update({
                    where: { id: customer.Id },
                    data: {
                        ...customerData,
                        updatedAt: new Date()
                    }
                });
                updated++;
            } else {
                // Create new customer
                await prisma.customer.create({
                    data: {
                        id: customer.Id,
                        ...customerData,
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

        const message = `${customers.length} customer(s) synced successfully: ${created} created, ${updated} updated`;
        console.log(message);

        return {
            success: true,
            totalCustomers: customers.length,
            created,
            updated,
            message
        };

    } catch (error) {
        console.error('Error syncing Customers:', error);
        
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

        throw new Error(`Customer sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Get Customers from database with pagination and filtering
 */
const getCustomers = async (options: {
    page?: number;
    limit?: number;
    search?: string;
    active?: boolean;
    realmId?: string;
} = {}): Promise<{
    customers: Customer[];
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
                { displayName: { contains: options.search, mode: 'insensitive' } },
                { firstName: { contains: options.search, mode: 'insensitive' } },
                { lastName: { contains: options.search, mode: 'insensitive' } },
                { email: { contains: options.search, mode: 'insensitive' } },
                { phone: { contains: options.search, mode: 'insensitive' } }
            ];
        }

        if (options.active !== undefined) {
            where.active = options.active;
        }

        // Get total count
        const totalCount = await prisma.customer.count({ where });

        // Get customers with pagination
        const customers = await prisma.customer.findMany({
            where,
            orderBy: { displayName: 'asc' },
            skip,
            take: limit
        });

        const totalPages = Math.ceil(totalCount / limit);

        return {
            customers,
            totalCount,
            totalPages,
            currentPage: page
        };
    } catch (error) {
        throw new Error(`Failed to fetch Customers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Get Customer statistics
 */
const getCustomerStats = async (realmId?: string): Promise<{
    totalCustomers: number;
    activeCustomers: number;
    inactiveCustomers: number;
    customersWithEmail: number;
    customersWithPhone: number;
    customersWithBalance: number;
    totalBalance: number;
    averageBalance: number;
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

        // Get all customers
        const customers = await prisma.customer.findMany({
            where,
            select: {
                active: true,
                email: true,
                phone: true,
                balance: true,
                updatedAt: true
            }
        });

        // Calculate statistics
        const customersWithBalance = customers.filter(c => c.balance && c.balance > 0);
        const totalBalance = customersWithBalance.reduce((sum, c) => sum + (c.balance || 0), 0);

        const stats = {
            totalCustomers: customers.length,
            activeCustomers: customers.filter(c => c.active).length,
            inactiveCustomers: customers.filter(c => !c.active).length,
            customersWithEmail: customers.filter(c => c.email).length,
            customersWithPhone: customers.filter(c => c.phone).length,
            customersWithBalance: customersWithBalance.length,
            totalBalance: totalBalance,
            averageBalance: customersWithBalance.length > 0 ? totalBalance / customersWithBalance.length : 0,
            lastSyncTime: null as Date | null
        };

        // Get last sync time
        const lastUpdated = await prisma.customer.findFirst({
            where,
            orderBy: { updatedAt: 'desc' },
            select: { updatedAt: true }
        });

        stats.lastSyncTime = lastUpdated?.updatedAt || null;

        return stats;
    } catch (error) {
        throw new Error(`Failed to fetch Customer statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Get customer by ID
 */
const getCustomerById = async (customerId: string, realmId?: string): Promise<Customer | null> => {
    try {
        const where: any = { id: customerId };

        // Filter by realmId if provided
        if (realmId) {
            const connection = await prisma.qBOConnection.findUnique({
                where: { realmId }
            });
            if (connection) {
                where.qboConnectionId = connection.id;
            }
        }

        const customer = await prisma.customer.findFirst({
            where
        });

        return customer;
    } catch (error) {
        throw new Error(`Failed to fetch Customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Search customers by name or email
 */
const searchCustomers = async (searchTerm: string, realmId?: string, limit: number = 10): Promise<Customer[]> => {
    try {
        const where: any = {
            OR: [
                { displayName: { contains: searchTerm, mode: 'insensitive' } },
                { firstName: { contains: searchTerm, mode: 'insensitive' } },
                { lastName: { contains: searchTerm, mode: 'insensitive' } },
                { email: { contains: searchTerm, mode: 'insensitive' } }
            ]
        };

        // Filter by realmId if provided
        if (realmId) {
            const connection = await prisma.qBOConnection.findUnique({
                where: { realmId }
            });
            if (connection) {
                where.qboConnectionId = connection.id;
            }
        }

        const customers = await prisma.customer.findMany({
            where,
            orderBy: { displayName: 'asc' },
            take: Math.min(limit, 50) // Max 50 results
        });

        return customers;
    } catch (error) {
        throw new Error(`Failed to search Customers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

// Export service functions
const customerService = {
    syncCustomers,
    getCustomers,
    getCustomerStats,
    getCustomerById,
    searchCustomers
};

export default customerService;