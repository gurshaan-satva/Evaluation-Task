// services/itemService.ts

import axios from 'axios';
import { prisma } from '../config/db';
import { Item, ItemType } from '@prisma/client';
import { QBOItem, QBOQueryResponse } from '../types/item';

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
 * Map QuickBooks item type to our ItemType enum
 */
const mapQBOItemType = (qboType: string): ItemType => {
    switch (qboType) {
        case 'Inventory':
            return 'Inventory';
        case 'Service':
            return 'Service';
        case 'Category':
            return 'Category';
        case 'NonInventory':
        default:
            return 'Service'; // Map NonInventory to Service as fallback
    }
};

/**
 * Sync Items from QuickBooks to database
 * Uses incremental sync based on last updated timestamp
 */
const syncItems = async (accessToken: string, realmId: string): Promise<{
    success: boolean;
    totalItems: number;
    created: number;
    updated: number;
    skipped: number;
    message: string;
}> => {
    try {
        // Find or create QBO connection
        const qboConnectionId = await findOrCreateConnection(realmId, accessToken);

        // 1. Find the most recently updated item in DB for this connection
        const latest = await prisma.item.findFirst({
            where: { qboConnectionId },
            orderBy: { lastUpdatedTime: 'desc' },
            select: { lastUpdatedTime: true },
        });

        // 2. Build dynamic query for incremental sync
        const query = latest?.lastUpdatedTime
            ? `SELECT * FROM Item WHERE MetaData.LastUpdatedTime > '${latest.lastUpdatedTime.toISOString()}'`
            : `SELECT * FROM Item`;

        console.log('Executing QuickBooks Item query:', query);

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

        const items = response.data.QueryResponse.Item || [];
        console.log(`Fetched ${items.length} items from QuickBooks`);

        if (items.length === 0) {
            return {
                success: true,
                totalItems: 0,
                created: 0,
                updated: 0,
                skipped: 0,
                message: 'No new or updated items found in QuickBooks'
            };
        }

        // 4. Save or update the records in the database
        let created = 0;
        let updated = 0;
        let skipped = 0;

        const upsertPromises = items.map(async (item: QBOItem) => {
            try {
                const existingItem = await prisma.item.findUnique({
                    where: { id: item.Id }
                });

                const itemData = {
                    name: item.Name,
                    fullyQualifiedName: item.FullyQualifiedName || null,
                    type: mapQBOItemType(item.Type),
                    description: item.Description || null,
                    unitPrice: item.UnitPrice || null,
                    purchaseCost: item.PurchaseCost || null,
                    quantityOnHand: item.QtyOnHand || null,
                    invStartDate: item.InvStartDate ? new Date(item.InvStartDate) : null,
                    incomeAccountRef: item.IncomeAccountRef?.value || null,
                    incomeAccountName: item.IncomeAccountRef?.name || null,
                    expenseAccountRef: item.ExpenseAccountRef?.value || null,
                    expenseAccountName: item.ExpenseAccountRef?.name || null,
                    assetAccountRef: item.AssetAccountRef?.value || null,
                    assetAccountName: item.AssetAccountRef?.name || null,
                    trackQtyOnHand: item.Type === 'Inventory' ? true : false, // Inventory items typically track quantity
                    taxable: item.Taxable || false,
                    active: item.Active ?? true,
                    syncToken: item.SyncToken,
                    domain: item.domain,
                    createTime: item.MetaData?.CreateTime ? new Date(item.MetaData.CreateTime) : null,
                    lastUpdatedTime: item.MetaData?.LastUpdatedTime ? new Date(item.MetaData.LastUpdatedTime) : null,
                    qboConnectionId // Use the found/created connection ID
                };

                if (existingItem) {
                    // Update existing item
                    await prisma.item.update({
                        where: { id: item.Id },
                        data: {
                            ...itemData,
                            updatedAt: new Date()
                        }
                    });
                    updated++;
                } else {
                    // Create new item
                    await prisma.item.create({
                        data: {
                            id: item.Id,
                            ...itemData,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }
                    });
                    created++;
                }
            } catch (error) {
                console.error(`Error processing item ${item.Id}:`, error);
                skipped++;
            }
        });

        await Promise.all(upsertPromises);

        // Update connection's last sync timestamp
        await prisma.qBOConnection.update({
            where: { id: qboConnectionId },
            data: { lastSyncAt: new Date() }
        });

        const message = `${items.length} item(s) processed: ${created} created, ${updated} updated${skipped > 0 ? `, ${skipped} skipped` : ''}`;
        console.log(message);

        return {
            success: true,
            totalItems: items.length,
            created,
            updated,
            skipped,
            message
        };

    } catch (error) {
        console.error('Error syncing Items:', error);
        
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

        throw new Error(`Item sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Get Items from database with pagination and filtering
 */
const getItems = async (options: {
    page?: number;
    limit?: number;
    search?: string;
    type?: ItemType;
    active?: boolean;
    taxable?: boolean;
    realmId?: string;
} = {}): Promise<{
    items: Item[];
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
                { fullyQualifiedName: { contains: options.search, mode: 'insensitive' } },
                { description: { contains: options.search, mode: 'insensitive' } }
            ];
        }

        if (options.type) {
            where.type = options.type;
        }

        if (options.active !== undefined) {
            where.active = options.active;
        }

        if (options.taxable !== undefined) {
            where.taxable = options.taxable;
        }

        // Get total count
        const totalCount = await prisma.item.count({ where });

        // Get items with pagination
        const items = await prisma.item.findMany({
            where,
            orderBy: { name: 'asc' },
            skip,
            take: limit
        });

        const totalPages = Math.ceil(totalCount / limit);

        return {
            items,
            totalCount,
            totalPages,
            currentPage: page
        };
    } catch (error) {
        throw new Error(`Failed to fetch Items: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Get Item statistics
 */
const getItemStats = async (realmId?: string): Promise<{
    totalItems: number;
    activeItems: number;
    inactiveItems: number;
    serviceItems: number;
    inventoryItems: number;
    categoryItems: number;
    taxableItems: number;
    itemsWithPrice: number;
    averagePrice: number;
    totalInventoryValue: number;
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

        // Get all items
        const items = await prisma.item.findMany({
            where,
            select: {
                active: true,
                type: true,
                taxable: true,
                unitPrice: true,
                quantityOnHand: true,
                updatedAt: true
            }
        });

        // Calculate statistics
        const itemsWithPrice = items.filter(item => item.unitPrice && item.unitPrice > 0);
        const totalPrice = itemsWithPrice.reduce((sum, item) => sum + (item.unitPrice || 0), 0);
        
        // Calculate inventory value (unitPrice * quantityOnHand for inventory items)
        const inventoryValue = items
            .filter(item => item.type === 'Inventory' && item.unitPrice && item.quantityOnHand)
            .reduce((sum, item) => sum + ((item.unitPrice || 0) * (item.quantityOnHand || 0)), 0);

        const stats = {
            totalItems: items.length,
            activeItems: items.filter(item => item.active).length,
            inactiveItems: items.filter(item => !item.active).length,
            serviceItems: items.filter(item => item.type === 'Service').length,
            inventoryItems: items.filter(item => item.type === 'Inventory').length,
            categoryItems: items.filter(item => item.type === 'Category').length,
            taxableItems: items.filter(item => item.taxable).length,
            itemsWithPrice: itemsWithPrice.length,
            averagePrice: itemsWithPrice.length > 0 ? totalPrice / itemsWithPrice.length : 0,
            totalInventoryValue: inventoryValue,
            lastSyncTime: null as Date | null
        };

        // Get last sync time
        const lastUpdated = await prisma.item.findFirst({
            where,
            orderBy: { updatedAt: 'desc' },
            select: { updatedAt: true }
        });

        stats.lastSyncTime = lastUpdated?.updatedAt || null;

        return stats;
    } catch (error) {
        throw new Error(`Failed to fetch Item statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Get item by ID
 */
const getItemById = async (itemId: string, realmId?: string): Promise<Item | null> => {
    try {
        const where: any = { id: itemId };

        // Filter by realmId if provided
        if (realmId) {
            const connection = await prisma.qBOConnection.findUnique({
                where: { realmId }
            });
            if (connection) {
                where.qboConnectionId = connection.id;
            }
        }

        const item = await prisma.item.findFirst({
            where
        });

        return item;
    } catch (error) {
        throw new Error(`Failed to fetch Item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Search items by name or description
 */
const searchItems = async (searchTerm: string, realmId?: string, limit: number = 20): Promise<Item[]> => {
    try {
        const where: any = {
            OR: [
                { name: { contains: searchTerm, mode: 'insensitive' } },
                { fullyQualifiedName: { contains: searchTerm, mode: 'insensitive' } },
                { description: { contains: searchTerm, mode: 'insensitive' } }
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

        const items = await prisma.item.findMany({
            where,
            orderBy: { name: 'asc' },
            take: Math.min(limit, 50) // Max 50 results
        });

        return items;
    } catch (error) {
        throw new Error(`Failed to search Items: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Get inventory items (items with quantity tracking)
 */
const getInventoryItems = async (realmId?: string, lowStockThreshold: number = 10): Promise<{
    inventoryItems: Item[];
    lowStockItems: Item[];
    outOfStockItems: Item[];
    totalInventoryValue: number;
}> => {
    try {
        const where: any = { 
            type: 'Inventory',
            active: true
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

        const inventoryItems = await prisma.item.findMany({
            where,
            orderBy: { name: 'asc' }
        });

        const lowStockItems = inventoryItems.filter(item => 
            (item.quantityOnHand || 0) > 0 && (item.quantityOnHand || 0) <= lowStockThreshold
        );

        const outOfStockItems = inventoryItems.filter(item => 
            (item.quantityOnHand || 0) === 0
        );

        const totalInventoryValue = inventoryItems.reduce((sum, item) => 
            sum + ((item.unitPrice || 0) * (item.quantityOnHand || 0)), 0
        );

        return {
            inventoryItems,
            lowStockItems,
            outOfStockItems,
            totalInventoryValue
        };
    } catch (error) {
        throw new Error(`Failed to fetch inventory items: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Get distinct item types for filtering
 */
const getItemTypes = async (realmId?: string): Promise<string[]> => {
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

        const types = await prisma.item.findMany({
            where,
            select: { type: true },
            distinct: ['type'],
            orderBy: { type: 'asc' }
        });

        return types.map(type => type.type);
    } catch (error) {
        throw new Error(`Failed to fetch item types: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

// Export service functions
const itemService = {
    syncItems,
    getItems,
    getItemStats,
    getItemById,
    searchItems,
    getInventoryItems,
    getItemTypes
};

export default itemService;