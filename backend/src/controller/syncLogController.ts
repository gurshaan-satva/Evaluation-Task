import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/responseHandler';
import syncLogService from '../service/syncLogService';
import { getStatusCode } from '../utils/errorHandler';

const getSyncLogs = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { 
            page = '1', 
            limit = '50', 
            transactionType,
            status,
            operation,
            dateFrom,
            dateTo,
            systemTransactionId,
            quickbooksId,
            search,
            sortBy = 'timestamp',
            sortOrder = 'desc'
        } = req.query as {
            page?: string;
            limit?: string;
            transactionType?: string;
            status?: string;
            operation?: string;
            dateFrom?: string;
            dateTo?: string;
            systemTransactionId?: string;
            quickbooksId?: string;
            search?: string;
            sortBy?: string;
            sortOrder?: 'asc' | 'desc';
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

        // Validate transaction type if provided
        if (transactionType) {
            const validTypes = ['INVOICE', 'PAYMENT', 'CUSTOMER', 'ITEM', 'ACCOUNT', 'CHART_OF_ACCOUNT'];
            if (!validTypes.includes(transactionType)) {
                return sendError(res, `Transaction type must be one of: ${validTypes.join(', ')}`, null, 400);
            }
        }

        // Validate status if provided
        if (status) {
            const validStatuses = ['PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED', 'RETRY', 'CANCELLED'];
            if (!validStatuses.includes(status)) {
                return sendError(res, `Status must be one of: ${validStatuses.join(', ')}`, null, 400);
            }
        }

        // Validate operation if provided
        if (operation) {
            const validOperations = ['CREATE', 'UPDATE', 'DELETE', 'READ'];
            if (!validOperations.includes(operation)) {
                return sendError(res, `Operation must be one of: ${validOperations.join(', ')}`, null, 400);
            }
        }

        // Validate sort order if provided
        if (sortOrder && !['asc', 'desc'].includes(sortOrder)) {
            return sendError(res, 'Sort order must be either "asc" or "desc"', null, 400);
        }

        // Validate sortBy field if provided
        if (sortBy) {
            const validSortFields = [
                'timestamp', 'transactionType', 'status', 'operation', 
                'systemTransactionId', 'quickbooksId', 'duration', 
                'retryCount', 'createdAt', 'updatedAt'
            ];
            if (!validSortFields.includes(sortBy)) {
                return sendError(res, `Sort field must be one of: ${validSortFields.join(', ')}`, null, 400);
            }
        }

        // Validate dates if provided
        if (dateFrom && isNaN(Date.parse(dateFrom))) {
            return sendError(res, 'dateFrom must be a valid ISO date string', null, 400);
        }

        if (dateTo && isNaN(Date.parse(dateTo))) {
            return sendError(res, 'dateTo must be a valid ISO date string', null, 400);
        }

        // Validate date range
        if (dateFrom && dateTo) {
            const fromDate = new Date(dateFrom);
            const toDate = new Date(dateTo);
            if (fromDate > toDate) {
                return sendError(res, 'dateFrom must be earlier than or equal to dateTo', null, 400);
            }
        }

        const { realmId } = req.qbAuth!;

        // Get sync logs through service
        const result = await syncLogService.getSyncLogs({
            page: pageNum,
            limit: limitNum,
            transactionType: transactionType || undefined,
            status: status || undefined,
            operation: operation || undefined,
            realmId,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            systemTransactionId: systemTransactionId || undefined,
            quickbooksId: quickbooksId || undefined,
            search: search || undefined,
            sortBy: sortBy || 'timestamp',
            sortOrder: sortOrder || 'desc'
        });

        const responseData = {
            syncLogs: result.syncLogs,
            pagination: {
                currentPage: result.currentPage,
                totalPages: result.totalPages,
                totalCount: result.totalCount,
                limit: limitNum,
                hasNextPage: result.currentPage < result.totalPages,
                hasPreviousPage: result.currentPage > 1
            },
            filters: {
                transactionType: transactionType || null,
                status: status || null,
                operation: operation || null,
                dateFrom: dateFrom || null,
                dateTo: dateTo || null,
                systemTransactionId: systemTransactionId || null,
                quickbooksId: quickbooksId || null,
                search: search || null
            },
            sorting: {
                sortBy: sortBy || 'timestamp',
                sortOrder: sortOrder || 'desc'
            },
            summary: result.summary
        };

        return sendSuccess(res, 'Sync logs retrieved successfully', responseData);

    } catch (error) {
        console.error('Error getting sync logs:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to get sync logs',
            { 
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            statusCode
        );
    }
};

const getSyncLogById = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { syncLogId } = req.params;

        if (!syncLogId) {
            return sendError(res, 'Sync log ID is required', null, 400);
        }

        const { realmId } = req.qbAuth!;

        const syncLog = await syncLogService.getSyncLogById(syncLogId, realmId);

        return sendSuccess(res, 'Sync log retrieved successfully', { syncLog });

    } catch (error) {
        console.error('Error getting sync log by ID:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to get sync log',
            { 
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            statusCode
        );
    }
};

const getSyncLogsByTransactionId = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { transactionId } = req.params;

        if (!transactionId) {
            return sendError(res, 'Transaction ID is required', null, 400);
        }

        const { realmId } = req.qbAuth!;

        const syncLogs = await syncLogService.getSyncLogsByTransactionId(transactionId, realmId);

        const responseData = {
            syncLogs,
            count: syncLogs.length,
            transactionId
        };

        return sendSuccess(res, 'Sync logs retrieved successfully', responseData);

    } catch (error) {
        console.error('Error getting sync logs by transaction ID:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to get sync logs by transaction ID',
            { 
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            statusCode
        );
    }
};

export const syncLogController = {
    getSyncLogs,
    getSyncLogById,
    getSyncLogsByTransactionId
};