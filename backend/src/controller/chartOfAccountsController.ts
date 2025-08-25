// controllers/chartOfAccountsController.ts

import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/responseHandler';
import chartOfAccountsService from '../service/chartOfAccountsService';
import { getStatusCode } from '../utils/errorHandler';

const syncChartOfAccounts = async (req: Request, res: Response): Promise<Response> => {
    try {
        // Get auth info from middleware
        const { accessToken, realmId } = req.qbAuth!;

        console.log(`Starting Chart of Accounts sync for realm: ${realmId}`);

        // Perform sync
        const syncResult = await chartOfAccountsService.syncChartOfAccounts(accessToken, realmId);

        // Prepare response data
        const responseData = {
            realmId,
            syncResult: {
                totalAccounts: syncResult.totalAccounts,
                created: syncResult.created,
                updated: syncResult.updated,
                successRate: syncResult.totalAccounts > 0 
                    ? ((syncResult.created + syncResult.updated) / syncResult.totalAccounts * 100).toFixed(2) + '%'
                    : '100%'
            },
            summary: syncResult.message
        };

        console.log(`Chart of Accounts sync completed for realm ${realmId}:`, syncResult);

        return sendSuccess(res, syncResult.message, responseData, 200);

    } catch (error) {
        console.error('Error syncing Chart of Accounts:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to sync Chart of Accounts',
            { 
                error: error instanceof Error ? error.message : 'Unknown error',
                realmId: req.qbAuth?.realmId
            },
            statusCode
        );
    }
};


const getChartOfAccounts = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { 
            page = '1', 
            limit = '50', 
            search, 
            accountType, 
            active 
        } = req.query as {
            page?: string;
            limit?: string;
            search?: string;
            accountType?: string;
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

        // Fetch accounts
        const result = await chartOfAccountsService.getChartOfAccounts({
            page: pageNum,
            limit: limitNum,
            search: search || undefined,
            accountType: accountType || undefined,
            active: activeFilter
        });

        return sendSuccess(res, 'Chart of Accounts retrieved successfully', {
            accounts: result.accounts,
            pagination: {
                currentPage: result.currentPage,
                totalPages: result.totalPages,
                totalCount: result.totalCount,
                hasNextPage: result.currentPage < result.totalPages,
                hasPreviousPage: result.currentPage > 1
            },
            filters: {
                search: search || null,
                accountType: accountType || null,
                active: activeFilter
            }
        });

    } catch (error) {
        console.error('Error fetching Chart of Accounts:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to fetch Chart of Accounts',
            { 
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            statusCode
        );
    }
};


const getChartOfAccountsStats = async (req: Request, res: Response): Promise<Response> => {
    try {
        const stats = await chartOfAccountsService.getChartOfAccountsStats();

        return sendSuccess(res, 'Chart of Accounts statistics retrieved successfully', stats);

    } catch (error) {
        console.error('Error fetching Chart of Accounts statistics:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to fetch Chart of Accounts statistics',
            { 
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            statusCode
        );
    }
};


const getAccountTypes = async (req: Request, res: Response): Promise<Response> => {
    try {
        const accountTypes = await chartOfAccountsService.getAccountTypes();

        return sendSuccess(res, 'Account types retrieved successfully', {
            accountTypes,
            totalTypes: accountTypes.length
        });

    } catch (error) {
        console.error('Error fetching account types:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to fetch account types',
            { 
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            statusCode
        );
    }
};

// Export all controller functions
const chartOfAccountsController = {
    syncChartOfAccounts,
    getChartOfAccounts,
    getChartOfAccountsStats,
    getAccountTypes
};

export { chartOfAccountsController };