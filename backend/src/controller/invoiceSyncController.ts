// controllers/invoiceSyncController.ts

import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { sendSuccess, sendError } from '../utils/responseHandler';
import invoiceSyncService from '../service/invoiceSyncService';
import { getStatusCode } from '../utils/errorHandler';

/**
 * Sync single invoice to QuickBooks
 * POST /api/v1/qbo/invoices/sync/:invoiceId
 */
const syncSingleInvoice = async (req: Request, res: Response): Promise<Response> => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', {
                errors: errors.array()
            }, 400);
        }

        const { invoiceId } = req.params;
        const { accessToken, realmId } = req.qbAuth!;

        console.log(`📄 Starting single invoice sync for ID: ${invoiceId}`);

        // Perform sync through service
        const syncResult = await invoiceSyncService.syncInvoiceToQBO(invoiceId, accessToken, realmId);

        if (!syncResult.success) {
            const statusCode = syncResult.error === 'ALREADY_SYNCED' ? 409 : 400;
            return sendError(res, syncResult.message, {
                invoiceId,
                error: syncResult.error,
                realmId
            }, statusCode);
        }

        const responseData = {
            invoiceId,
            qboInvoiceId: syncResult.qboInvoiceId,
            syncToken: syncResult.syncToken,
            realmId,
            syncedAt: new Date().toISOString(),
            status: 'SUCCESS'
        };

        console.log(`✅ Single invoice sync completed for ID: ${invoiceId}`);

        return sendSuccess(res, syncResult.message, responseData, 201);

    } catch (error) {
        console.error('Error syncing single invoice:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to sync invoice to QuickBooks',
            { 
                error: error instanceof Error ? error.message : 'Unknown error',
                invoiceId: req.params?.invoiceId,
                realmId: req.qbAuth?.realmId
            },
            statusCode
        );
    }
};

/**
 * Sync all pending invoices to QuickBooks
 * POST /api/v1/qbo/invoices/sync
 */
const syncAllInvoices = async (req: Request, res: Response): Promise<Response> => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', {
                errors: errors.array()
            }, 400);
        }

        const { accessToken, realmId } = req.qbAuth!;

        console.log(`📄 Starting batch invoice sync for realm: ${realmId} (processing in batches of 10)`);

        // Perform batch sync through service (no limit parameter needed)
        const syncResult = await invoiceSyncService.syncAllInvoicesToQBO(accessToken, realmId);

        // Prepare detailed response
        const responseData = {
            realmId,
            batchSyncSummary: {
                totalProcessed: syncResult.totalProcessed,
                successCount: syncResult.successCount,
                failureCount: syncResult.failureCount,
                totalBatches: Math.ceil(syncResult.totalProcessed / 10),
                batchSize: 10,
                successRate: syncResult.totalProcessed > 0 
                    ? ((syncResult.successCount / syncResult.totalProcessed) * 100).toFixed(2) + '%'
                    : '100%'
            },
            results: syncResult.results,
            processedAt: new Date().toISOString(),
            message: syncResult.message
        };

        // Determine response status based on results
        const hasFailures = syncResult.failureCount > 0;
        const hasSuccesses = syncResult.successCount > 0;
        
        let statusCode = 200;
        let message = syncResult.message;

        if (syncResult.totalProcessed === 0) {
            statusCode = 200;
            message = 'No pending invoices found to sync';
        } else if (hasSuccesses && !hasFailures) {
            statusCode = 200;
            message = `All ${syncResult.successCount} invoices synced successfully`;
        } else if (hasSuccesses && hasFailures) {
            statusCode = 207; // Multi-Status
            message = `Partial success: ${syncResult.successCount} synced, ${syncResult.failureCount} failed`;
        } else if (!hasSuccesses && hasFailures) {
            statusCode = 400;
            message = `All ${syncResult.failureCount} sync attempts failed`;
        }

        console.log(`📊 Batch invoice sync completed: ${syncResult.successCount}/${syncResult.totalProcessed} successful`);

        return sendSuccess(res, message, responseData, statusCode);

    } catch (error) {
        console.error('Error syncing all invoices:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to sync invoices to QuickBooks',
            { 
                error: error instanceof Error ? error.message : 'Unknown error',
                realmId: req.qbAuth?.realmId
            },
            statusCode
        );
    }
};

/**
 * Get invoice sync status and history
 * GET /api/v1/qbo/invoices/sync/:invoiceId/status
 */
const getInvoiceSyncStatus = async (req: Request, res: Response): Promise<Response> => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', {
                errors: errors.array()
            }, 400);
        }

        const { invoiceId } = req.params;

        console.log(`📋 Getting sync status for invoice: ${invoiceId}`);

        // Get sync status through service
        const statusData = await invoiceSyncService.getInvoiceSyncStatus(invoiceId);

        const responseData = {
            invoice: {
                id: statusData.invoice.id,
                docNumber: statusData.invoice.docNumber,
                total: statusData.invoice.total,
                status: statusData.invoice.status,
                qboInvoiceId: statusData.invoice.qboInvoiceId,
                syncStatus: statusData.invoice.syncStatus,
                syncToken: statusData.invoice.syncToken,
                lastSyncedAt: statusData.invoice.lastSyncedAt,
                customer: statusData.invoice.customer,
                createdAt: statusData.invoice.createdAt,
                updatedAt: statusData.invoice.updatedAt
            },
            syncHistory: statusData.syncLogs.map(log => ({
                id: log.id,
                status: log.status,
                operation: log.operation,
                quickbooksId: log.quickbooksId,
                timestamp: log.timestamp,
                errorMessage: log.errorMessage,
                errorCode: log.errorCode,
                duration: log.duration,
                retryCount: log.retryCount
            })),
            summary: {
                isSynced: !!statusData.invoice.qboInvoiceId,
                lastSyncAttempt: statusData.lastSync,
                currentStatus: statusData.status,
                totalSyncAttempts: statusData.syncLogs.length,
                successfulSyncs: statusData.syncLogs.filter(log => log.status === 'SUCCESS').length,
                failedSyncs: statusData.syncLogs.filter(log => log.status === 'FAILED').length
            }
        };

        return sendSuccess(res, 'Invoice sync status retrieved successfully', responseData);

    } catch (error) {
        console.error('Error getting invoice sync status:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to get invoice sync status',
            { 
                error: error instanceof Error ? error.message : 'Unknown error',
                invoiceId: req.params?.invoiceId
            },
            statusCode
        );
    }
};

/**
 * Get all invoices with their sync status
 * GET /api/v1/qbo/invoices/sync/status
 */
const getAllInvoicesSyncStatus = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { 
            page = '1', 
            limit = '50', 
            syncStatus,
            status,
            dateFrom,
            dateTo
        } = req.query as {
            page?: string;
            limit?: string;
            syncStatus?: string;
            status?: string;
            dateFrom?: string;
            dateTo?: string;
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

        // Validate sync status if provided
        if (syncStatus) {
            const validSyncStatuses = ['PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED', 'RETRY', 'CANCELLED'];
            if (!validSyncStatuses.includes(syncStatus)) {
                return sendError(res, `Sync status must be one of: ${validSyncStatuses.join(', ')}`, null, 400);
            }
        }

        // Validate invoice status if provided
        if (status) {
            const validStatuses = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED', 'VOID'];
            if (!validStatuses.includes(status)) {
                return sendError(res, `Status must be one of: ${validStatuses.join(', ')}`, null, 400);
            }
        }

        // Validate dates if provided
        if (dateFrom && isNaN(Date.parse(dateFrom))) {
            return sendError(res, 'dateFrom must be a valid ISO date string', null, 400);
        }

        if (dateTo && isNaN(Date.parse(dateTo))) {
            return sendError(res, 'dateTo must be a valid ISO date string', null, 400);
        }

        const { realmId } = req.qbAuth!;

        // Get invoices sync status through service
        const result = await invoiceSyncService.getAllInvoicesSyncStatus({
            page: pageNum,
            limit: limitNum,
            syncStatus: syncStatus || undefined,
            status: status || undefined,
            realmId,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined
        });

        const responseData = {
            invoices: result.invoices,
            pagination: {
                currentPage: result.currentPage,
                totalPages: result.totalPages,
                totalCount: result.totalCount,
                hasNextPage: result.currentPage < result.totalPages,
                hasPreviousPage: result.currentPage > 1
            },
            filters: {
                syncStatus: syncStatus || null,
                status: status || null,
                dateFrom: dateFrom || null,
                dateTo: dateTo || null
            },
            summary: result.summary
        };

        return sendSuccess(res, 'Invoices sync status retrieved successfully', responseData);

    } catch (error) {
        console.error('Error getting all invoices sync status:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to get invoices sync status',
            { 
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            statusCode
        );
    }
};

/**
 * Get sync statistics
 * GET /api/v1/qbo/invoices/sync/statistics
 */
const getSyncStatistics = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { realmId } = req.qbAuth!;

        console.log(`📊 Getting sync statistics for realm: ${realmId}`);

        // Get statistics through service
        const statistics = await invoiceSyncService.getSyncStatistics(realmId);

        return sendSuccess(res, 'Sync statistics retrieved successfully', statistics);

    } catch (error) {
        console.error('Error getting sync statistics:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to get sync statistics',
            { 
                error: error instanceof Error ? error.message : 'Unknown error',
                realmId: req.qbAuth?.realmId
            },
            statusCode
        );
    }
};

/**
 * Retry syncing a failed invoice
 * POST /api/v1/qbo/invoices/sync/:invoiceId/retry
 */
const retryInvoiceSync = async (req: Request, res: Response): Promise<Response> => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', {
                errors: errors.array()
            }, 400);
        }

        const { invoiceId } = req.params;
        const { forceRetry } = req.body;
        const { accessToken, realmId } = req.qbAuth!;

        console.log(`🔄 Retrying invoice sync for ID: ${invoiceId}`);

        // First, check if the invoice exists and its current status
        const statusData = await invoiceSyncService.getInvoiceSyncStatus(invoiceId);
        
        // Check if retry is allowed
        if (!forceRetry && statusData.invoice.syncStatus === 'SUCCESS') {
            return sendError(res, 'Invoice is already successfully synced. Use forceRetry=true to force retry.', {
                invoiceId,
                currentStatus: statusData.invoice.syncStatus,
                qboInvoiceId: statusData.invoice.qboInvoiceId
            }, 400);
        }

        if (!forceRetry && statusData.invoice.syncStatus === 'IN_PROGRESS') {
            return sendError(res, 'Invoice sync is currently in progress. Please wait for completion.', {
                invoiceId,
                currentStatus: statusData.invoice.syncStatus
            }, 400);
        }

        // Perform retry sync through service (same as single sync)
        const syncResult = await invoiceSyncService.syncInvoiceToQBO(invoiceId, accessToken, realmId);

        if (!syncResult.success) {
            return sendError(res, syncResult.message, {
                invoiceId,
                error: syncResult.error,
                realmId,
                isRetry: true
            }, 400);
        }

        const responseData = {
            invoiceId,
            qboInvoiceId: syncResult.qboInvoiceId,
            syncToken: syncResult.syncToken,
            realmId,
            syncedAt: new Date().toISOString(),
            status: 'SUCCESS',
            isRetry: true,
            previousFailures: statusData.syncLogs.filter(log => log.status === 'FAILED').length
        };

        console.log(`✅ Invoice retry sync completed for ID: ${invoiceId}`);

        return sendSuccess(res, `Invoice retry sync successful: ${syncResult.message}`, responseData, 200);

    } catch (error) {
        console.error('Error retrying invoice sync:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to retry invoice sync',
            { 
                error: error instanceof Error ? error.message : 'Unknown error',
                invoiceId: req.params?.invoiceId,
                realmId: req.qbAuth?.realmId,
                isRetry: true
            },
            statusCode
        );
    }
};

/**
 * Get all invoices with pagination and filtering
 * GET /api/v1/qbo/invoices
 */
const getInvoices = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { 
            page = '1', 
            limit = '50', 
            search,
            status,
            syncStatus,
            dateFrom,
            dateTo,
            customerId
        } = req.query as {
            page?: string;
            limit?: string;
            search?: string;
            status?: string;
            syncStatus?: string;
            dateFrom?: string;
            dateTo?: string;
            customerId?: string;
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

        // Validate status if provided
        if (status) {
            const validStatuses = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED', 'VOID'];
            if (!validStatuses.includes(status)) {
                return sendError(res, `Status must be one of: ${validStatuses.join(', ')}`, null, 400);
            }
        }

        // Validate sync status if provided
        if (syncStatus) {
            const validSyncStatuses = ['PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED', 'RETRY', 'CANCELLED'];
            if (!validSyncStatuses.includes(syncStatus)) {
                return sendError(res, `Sync status must be one of: ${validSyncStatuses.join(', ')}`, null, 400);
            }
        }

        // Validate dates if provided
        if (dateFrom && isNaN(Date.parse(dateFrom))) {
            return sendError(res, 'dateFrom must be a valid ISO date string', null, 400);
        }

        if (dateTo && isNaN(Date.parse(dateTo))) {
            return sendError(res, 'dateTo must be a valid ISO date string', null, 400);
        }

        const { realmId } = req.qbAuth!;

        // Get invoices through service
        const result = await invoiceSyncService.getInvoices({
            page: pageNum,
            limit: limitNum,
            search: search || undefined,
            status: status || undefined,
            syncStatus: syncStatus || undefined,
            realmId,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            customerId: customerId || undefined
        });

        const responseData = {
            invoices: result.invoices,
            pagination: {
                currentPage: result.currentPage,
                totalPages: result.totalPages,
                totalCount: result.totalCount,
                hasNextPage: result.currentPage < result.totalPages,
                hasPreviousPage: result.currentPage > 1
            },
            filters: {
                search: search || null,
                status: status || null,
                syncStatus: syncStatus || null,
                dateFrom: dateFrom || null,
                dateTo: dateTo || null,
                customerId: customerId || null
            },
            summary: result.summary
        };

        return sendSuccess(res, 'Invoices retrieved successfully', responseData);

    } catch (error) {
        console.error('Error getting invoices:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to get invoices',
            { 
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            statusCode
        );
    }
};

/**
 * Get invoice by ID
 * GET /api/v1/qbo/invoices/:invoiceId
 */
const getInvoiceById = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { invoiceId } = req.params;

        if (!invoiceId) {
            return sendError(res, 'Invoice ID is required', null, 400);
        }

        const { realmId } = req.qbAuth!;

        // Get invoice through service
        const invoice = await invoiceSyncService.getInvoiceById(invoiceId, realmId);

        return sendSuccess(res, 'Invoice retrieved successfully', { invoice });

    } catch (error) {
        console.error('Error getting invoice by ID:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to get invoice',
            { 
                error: error instanceof Error ? error.message : 'Unknown error',
                invoiceId: req.params?.invoiceId
            },
            statusCode
        );
    }
};

// Export all controller functions
const invoiceSyncController = {
    syncSingleInvoice,
    syncAllInvoices,
    getInvoiceSyncStatus,
    getAllInvoicesSyncStatus,
    getSyncStatistics,
    retryInvoiceSync, 
    getInvoices,
    getInvoiceById
};

export { invoiceSyncController };