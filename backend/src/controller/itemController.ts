// controllers/itemController.ts

import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/responseHandler';
import itemService from '../service/itemService';
import { getStatusCode } from '../utils/errorHandler';

/**
 * Sync Items from QuickBooks to database
 * POST /api/v1/qbo/items/sync
 */
const syncItems = async (req: Request, res: Response): Promise<Response> => {
    try {
        // Get auth info from middleware
        const { accessToken, realmId } = req.qbAuth!;

        console.log(`Starting Item sync for realm: ${realmId}`);

        // Perform sync
        const syncResult = await itemService.syncItems(accessToken, realmId);

        // Prepare response data
        const responseData = {
            realmId,
            syncResult: {
                totalItems: syncResult.totalItems,
                created: syncResult.created,
                updated: syncResult.updated,
                skipped: syncResult.skipped,
                successRate: syncResult.totalItems > 0 
                    ? (((syncResult.created + syncResult.updated) / syncResult.totalItems) * 100).toFixed(2) + '%'
                    : '100%'
            },
            summary: syncResult.message
        };

        console.log(`Item sync completed for realm ${realmId}:`, syncResult);

        return sendSuccess(res, syncResult.message, responseData, 200);

    } catch (error) {
        console.error('Error syncing Items:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to sync Items',
            { 
                error: error instanceof Error ? error.message : 'Unknown error',
                realmId: req.qbAuth?.realmId
            },
            statusCode
        );
    }
};

/**
 * Get Items from database with pagination and filtering
 * GET /api/v1/qbo/items
 */
const getItems = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { 
            page = '1', 
            limit = '50', 
            search, 
            type,
            active,
            taxable
        } = req.query as {
            page?: string;
            limit?: string;
            search?: string;
            type?: string;
            active?: string;
            taxable?: string;
        };

        // Parse and validate query parameters
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        if (isNaN(pageNum) || pageNum < 1) {
            return sendError(res, 'Page must be a positive number', null, 400);
        }

        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
            return sendError(res, 'Limit must be between 1 and 100', null, 400);
        }

        // Validate type filter
        const validTypes = ['Service', 'Inventory', 'Category'];
        if (type && !validTypes.includes(type)) {
            return sendError(res, `Type must be one of: ${validTypes.join(', ')}`, null, 400);
        }

        // Parse boolean filters
        let activeFilter: boolean | undefined;
        if (active !== undefined) {
            if (active === 'true') {
                activeFilter = true;
            } else if (active === 'false') {
                activeFilter = false;
            } else {
                return sendError(res, 'Active filter must be "true" or "false"', null, 400);
            }
        }

        let taxableFilter: boolean | undefined;
        if (taxable !== undefined) {
            if (taxable === 'true') {
                taxableFilter = true;
            } else if (taxable === 'false') {
                taxableFilter = false;
            } else {
                return sendError(res, 'Taxable filter must be "true" or "false"', null, 400);
            }
        }

        // Fetch items
        const result = await itemService.getItems({
            page: pageNum,
            limit: limitNum,
            search: search || undefined,
            type: type as any,
            active: activeFilter,
            taxable: taxableFilter,
            realmId: req.qbAuth!.realmId
        });

        return sendSuccess(res, 'Items retrieved successfully', {
            items: result.items,
            pagination: {
                currentPage: result.currentPage,
                totalPages: result.totalPages,
                totalCount: result.totalCount,
                hasNextPage: result.currentPage < result.totalPages,
                hasPreviousPage: result.currentPage > 1
            },
            filters: {
                search: search || null,
                type: type || null,
                active: activeFilter,
                taxable: taxableFilter
            }
        });

    } catch (error) {
        console.error('Error fetching Items:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to fetch Items',
            { 
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            statusCode
        );
    }
};

/**
 * Get Item statistics
 * GET /api/v1/qbo/items/stats
 */
const getItemStats = async (req: Request, res: Response): Promise<Response> => {
    try {
        const stats = await itemService.getItemStats(req.qbAuth!.realmId);

        return sendSuccess(res, 'Item statistics retrieved successfully', stats);

    } catch (error) {
        console.error('Error fetching Item statistics:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to fetch Item statistics',
            { 
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            statusCode
        );
    }
};

/**
 * Get Item by ID
 * GET /api/v1/qbo/items/:itemId
 */
const getItemById = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { itemId } = req.params;

        if (!itemId) {
            return sendError(res, 'Item ID is required', null, 400);
        }

        const item = await itemService.getItemById(itemId, req.qbAuth!.realmId);

        if (!item) {
            return sendError(res, 'Item not found', null, 404);
        }

        return sendSuccess(res, 'Item retrieved successfully', { item });

    } catch (error) {
        console.error('Error fetching Item:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to fetch Item',
            { 
                error: error instanceof Error ? error.message : 'Unknown error',
                itemId: req.params?.itemId
            },
            statusCode
        );
    }
};

/**
 * Search Items
 * GET /api/v1/qbo/items/search
 */
const searchItems = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { q, limit = '20' } = req.query as {
            q?: string;
            limit?: string;
        };

        if (!q || typeof q !== 'string' || q.trim().length < 2) {
            return sendError(res, 'Search query must be at least 2 characters long', null, 400);
        }

        const limitNum = parseInt(limit);
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
            return sendError(res, 'Limit must be between 1 and 50', null, 400);
        }

        const items = await itemService.searchItems(q.trim(), req.qbAuth!.realmId, limitNum);

        return sendSuccess(res, 'Item search completed successfully', {
            items,
            searchQuery: q.trim(),
            totalResults: items.length
        });

    } catch (error) {
        console.error('Error searching Items:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to search Items',
            { 
                error: error instanceof Error ? error.message : 'Unknown error',
                searchQuery: req.query?.q
            },
            statusCode
        );
    }
};

/**
 * Get Inventory Items with stock information
 * GET /api/v1/qbo/items/inventory
 */
const getInventoryItems = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { lowStockThreshold = '10' } = req.query as {
            lowStockThreshold?: string;
        };

        const threshold = parseInt(lowStockThreshold);
        if (isNaN(threshold) || threshold < 0) {
            return sendError(res, 'Low stock threshold must be a non-negative number', null, 400);
        }

        const inventoryData = await itemService.getInventoryItems(req.qbAuth!.realmId, threshold);

        return sendSuccess(res, 'Inventory items retrieved successfully', {
            ...inventoryData,
            summary: {
                totalInventoryItems: inventoryData.inventoryItems.length,
                lowStockItems: inventoryData.lowStockItems.length,
                outOfStockItems: inventoryData.outOfStockItems.length,
                lowStockThreshold: threshold,
                totalInventoryValue: inventoryData.totalInventoryValue
            }
        });

    } catch (error) {
        console.error('Error fetching Inventory items:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to fetch Inventory items',
            { 
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            statusCode
        );
    }
};

/**
 * Get available item types for filtering
 * GET /api/v1/qbo/items/types
 */
const getItemTypes = async (req: Request, res: Response): Promise<Response> => {
    try {
        const itemTypes = await itemService.getItemTypes(req.qbAuth!.realmId);

        return sendSuccess(res, 'Item types retrieved successfully', {
            itemTypes,
            totalTypes: itemTypes.length
        });

    } catch (error) {
        console.error('Error fetching item types:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to fetch item types',
            { 
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            statusCode
        );
    }
};

/**
 * Get Item type summary with counts
 * GET /api/v1/qbo/items/type-summary
 */
const getItemTypeSummary = async (req: Request, res: Response): Promise<Response> => {
    try {
        const stats = await itemService.getItemStats(req.qbAuth!.realmId);

        const typeSummary = {
            service: {
                count: stats.serviceItems,
                percentage: stats.totalItems > 0 ? ((stats.serviceItems / stats.totalItems) * 100).toFixed(1) : '0'
            },
            inventory: {
                count: stats.inventoryItems,
                percentage: stats.totalItems > 0 ? ((stats.inventoryItems / stats.totalItems) * 100).toFixed(1) : '0'
            },
            category: {
                count: stats.categoryItems,
                percentage: stats.totalItems > 0 ? ((stats.categoryItems / stats.totalItems) * 100).toFixed(1) : '0'
            },
            total: stats.totalItems
        };

        return sendSuccess(res, 'Item type summary retrieved successfully', typeSummary);

    } catch (error) {
        console.error('Error fetching Item type summary:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to fetch Item type summary',
            { 
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            statusCode
        );
    }
};

// Export all controller functions
const itemController = {
    syncItems,
    getItems,
    getItemStats,
    getItemById,
    searchItems,
    getInventoryItems,
    getItemTypes,
    getItemTypeSummary
};

export { itemController };