// controllers/customerController.ts

import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/responseHandler';
import customerService from '../service/customerService';
import { getStatusCode } from '../utils/errorHandler';

const syncCustomers = async (req: Request, res: Response): Promise<Response> => {
    try {
        // Get auth info from middleware
        const { accessToken, realmId } = req.qbAuth!;

        console.log(`Starting Customer sync for realm: ${realmId}`);

        // Perform sync
        const syncResult = await customerService.syncCustomers(accessToken, realmId);

        // Prepare response data
        const responseData = {
            realmId,
            syncResult: {
                totalCustomers: syncResult.totalCustomers,
                created: syncResult.created,
                updated: syncResult.updated,
                successRate: syncResult.totalCustomers > 0 
                    ? ((syncResult.created + syncResult.updated) / syncResult.totalCustomers * 100).toFixed(2) + '%'
                    : '100%'
            },
            summary: syncResult.message
        };

        console.log(`Customer sync completed for realm ${realmId}:`, syncResult);

        return sendSuccess(res, syncResult.message, responseData, 200);

    } catch (error) {
        console.error('Error syncing Customers:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to sync Customers',
            { 
                error: error instanceof Error ? error.message : 'Unknown error',
                realmId: req.qbAuth?.realmId
            },
            statusCode
        );
    }
};


const getCustomers = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { 
            page = '1', 
            limit = '50', 
            search, 
            active 
        } = req.query as {
            page?: string;
            limit?: string;
            search?: string;
            active?: string;
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

        // Parse active filter
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

        // Fetch customers
        const result = await customerService.getCustomers({
            page: pageNum,
            limit: limitNum,
            search: search || undefined,
            active: activeFilter,
            realmId: req.qbAuth!.realmId
        });

        return sendSuccess(res, 'Customers retrieved successfully', {
            customers: result.customers,
            pagination: {
                currentPage: result.currentPage,
                totalPages: result.totalPages,
                totalCount: result.totalCount,
                hasNextPage: result.currentPage < result.totalPages,
                hasPreviousPage: result.currentPage > 1
            },
            filters: {
                search: search || null,
                active: activeFilter
            }
        });

    } catch (error) {
        console.error('Error fetching Customers:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to fetch Customers',
            { 
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            statusCode
        );
    }
};


const getCustomerStats = async (req: Request, res: Response): Promise<Response> => {
    try {
        const stats = await customerService.getCustomerStats(req.qbAuth!.realmId);

        return sendSuccess(res, 'Customer statistics retrieved successfully', stats);

    } catch (error) {
        console.error('Error fetching Customer statistics:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to fetch Customer statistics',
            { 
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            statusCode
        );
    }
};


const getCustomerById = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { customerId } = req.params;

        if (!customerId) {
            return sendError(res, 'Customer ID is required', null, 400);
        }

        const customer = await customerService.getCustomerById(customerId, req.qbAuth!.realmId);

        if (!customer) {
            return sendError(res, 'Customer not found', null, 404);
        }

        return sendSuccess(res, 'Customer retrieved successfully', { customer });

    } catch (error) {
        console.error('Error fetching Customer:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to fetch Customer',
            { 
                error: error instanceof Error ? error.message : 'Unknown error',
                customerId: req.params?.customerId
            },
            statusCode
        );
    }
};


const searchCustomers = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { q, limit = '10' } = req.query as {
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

        const customers = await customerService.searchCustomers(q.trim(), req.qbAuth!.realmId, limitNum);

        return sendSuccess(res, 'Customer search completed successfully', {
            customers,
            searchQuery: q.trim(),
            totalResults: customers.length
        });

    } catch (error) {
        console.error('Error searching Customers:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to search Customers',
            { 
                error: error instanceof Error ? error.message : 'Unknown error',
                searchQuery: req.query?.q
            },
            statusCode
        );
    }
};

// Export all controller functions
const customerController = {
    syncCustomers,
    getCustomers,
    getCustomerStats,
    getCustomerById,
    searchCustomers
};

export { customerController };