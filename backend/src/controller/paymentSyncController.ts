// controllers/paymentSyncController.ts

import { Request, Response } from 'express';
import paymentSyncService from '../service/paymentSyncService';
import { sendSuccess, sendError } from '../utils/responseHandler';
import { validationResult } from 'express-validator';
import { getStatusCode } from '../utils/errorHandler';

const syncSinglePayment = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { paymentId } = req.params;

        if (!paymentId) {
            return sendError(res, 'Payment ID is required', null, 400);
        }

        if (!req.qbAuth?.accessToken || !req.qbAuth?.realmId) {
            return sendError(res, 'QuickBooks authentication required', null, 401);
        }

        console.log(`🔄 Starting single payment sync for ID: ${paymentId}`);

        const syncResult = await paymentSyncService.syncPaymentToQBO(
            paymentId,
            req.qbAuth.accessToken,
            req.qbAuth.realmId
        );

        const statusCode = syncResult.success ? 201 : 400;
        const responseData = {
            paymentId,
            qboPaymentId: syncResult.qboPaymentId,
            syncToken: syncResult.syncToken,
            success: syncResult.success,
            realmId: req.qbAuth.realmId
        };

        console.log(`✅ Single payment sync completed for ID: ${paymentId}`);

        return sendSuccess(res, syncResult.message, responseData, statusCode);

    } catch (error) {
        console.error('Error syncing single payment:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to sync payment to QuickBooks',
            { 
                error: error instanceof Error ? error.message : 'Unknown error',
                paymentId: req.params?.paymentId,
                realmId: req.qbAuth?.realmId
            },
            statusCode
        );
    }
};


const syncAllPayments = async (req: Request, res: Response): Promise<Response> => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', {
                errors: errors.array()
            }, 400);
        }

        const { accessToken, realmId } = req.qbAuth!;

        console.log(`💰 Starting batch payment sync for realm: ${realmId} (processing in batches of 10)`);

        // Perform batch sync through service (no limit parameter needed)
        const syncResult = await paymentSyncService.syncAllPaymentsToQBO(accessToken, realmId);

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
            message = 'No pending payments found to sync';
        } else if (hasSuccesses && !hasFailures) {
            statusCode = 200;
            message = `All ${syncResult.successCount} payments synced successfully`;
        } else if (hasSuccesses && hasFailures) {
            statusCode = 207; // Multi-Status
            message = `Partial success: ${syncResult.successCount} synced, ${syncResult.failureCount} failed`;
        } else if (!hasSuccesses && hasFailures) {
            statusCode = 400;
            message = `All ${syncResult.failureCount} sync attempts failed`;
        }

        console.log(`📊 Batch payment sync completed: ${syncResult.successCount}/${syncResult.totalProcessed} successful`);

        return sendSuccess(res, message, responseData, statusCode);

    } catch (error) {
        console.error('Error syncing all payments:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to sync payments to QuickBooks',
            { 
                error: error instanceof Error ? error.message : 'Unknown error',
                realmId: req.qbAuth?.realmId
            },
            statusCode
        );
    }
};

const getPaymentSyncStatus = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { paymentId } = req.params;

        if (!paymentId) {
            return sendError(res, 'Payment ID is required', null, 400);
        }

        const statusResult = await paymentSyncService.getPaymentSyncStatus(paymentId);

        const responseData = {
            payment: {
                id: statusResult.payment.id,
                referenceNumber: statusResult.payment.referenceNumber,
                amount: statusResult.payment.amount,
                status: statusResult.payment.status,
                qboPaymentId: statusResult.payment.qboPaymentId,
                syncStatus: statusResult.payment.syncStatus,
                lastSyncedAt: statusResult.payment.lastSyncedAt,
                isSynced: !!statusResult.payment.qboPaymentId
            },
            syncLogs: statusResult.syncLogs,
            lastSync: statusResult.lastSync,
            status: statusResult.status
        };

        return sendSuccess(res, 'Payment sync status retrieved successfully', responseData);

    } catch (error) {
        console.error('Error getting payment sync status:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to get payment sync status',
            { 
                error: error instanceof Error ? error.message : 'Unknown error',
                paymentId: req.params?.paymentId
            },
            statusCode
        );
    }
};

const getAllPaymentsSyncStatus = async (req: Request, res: Response): Promise<Response> => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
        const syncStatus = req.query.syncStatus as string;
        const status = req.query.status as string;
        const dateFrom = req.query.dateFrom as string;
        const dateTo = req.query.dateTo as string;

        if (!req.qbAuth?.realmId) {
            return sendError(res, 'QuickBooks authentication required', null, 401);
        }

        const result = await paymentSyncService.getAllPaymentsSyncStatus({
            page,
            limit,
            syncStatus,
            status,
            realmId: req.qbAuth.realmId,
            dateFrom,
            dateTo
        });

        return sendSuccess(res, 'Payments sync status retrieved successfully', result);

    } catch (error) {
        console.error('Error getting all payments sync status:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to get payments sync status',
            { 
                error: error instanceof Error ? error.message : 'Unknown error',
                realmId: req.qbAuth?.realmId
            },
            statusCode
        );
    }
};


const getPaymentSyncStatistics = async (req: Request, res: Response): Promise<Response> => {
    try {
        if (!req.qbAuth?.realmId) {
            return sendError(res, 'QuickBooks authentication required', null, 401);
        }

        const statistics = await paymentSyncService.getSyncStatistics(req.qbAuth.realmId);

        return sendSuccess(res, 'Payment sync statistics retrieved successfully', statistics);

    } catch (error) {
        console.error('Error getting payment sync statistics:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to get payment sync statistics',
            { 
                error: error instanceof Error ? error.message : 'Unknown error',
                realmId: req.qbAuth?.realmId
            },
            statusCode
        );
    }
};

const getPayments = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { 
            page = '1', 
            limit = '50', 
            search,
            status,
            syncStatus,
            paymentMethod,
            dateFrom,
            dateTo,
            invoiceId
        } = req.query as {
            page?: string;
            limit?: string;
            search?: string;
            status?: string;
            syncStatus?: string;
            paymentMethod?: string;
            dateFrom?: string;
            dateTo?: string;
            invoiceId?: string;
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
            const validStatuses = ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED'];
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

        // Validate payment method if provided
        if (paymentMethod) {
            const validMethods = ['CASH', 'CHECK', 'CREDIT_CARD', 'BANK_TRANSFER', 'ACH', 'WIRE_TRANSFER', 'OTHER'];
            if (!validMethods.includes(paymentMethod)) {
                return sendError(res, `Payment method must be one of: ${validMethods.join(', ')}`, null, 400);
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

        // Get payments through service
        const result = await paymentSyncService.getPayments({
            page: pageNum,
            limit: limitNum,
            search: search || undefined,
            status: status || undefined,
            syncStatus: syncStatus || undefined,
            paymentMethod: paymentMethod || undefined,
            realmId,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            invoiceId: invoiceId || undefined
        });

        const responseData = {
            payments: result.payments,
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
                paymentMethod: paymentMethod || null,
                dateFrom: dateFrom || null,
                dateTo: dateTo || null,
                invoiceId: invoiceId || null
            },
            summary: result.summary
        };

        return sendSuccess(res, 'Payments retrieved successfully', responseData);

    } catch (error) {
        console.error('Error getting payments:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to get payments',
            { 
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            statusCode
        );
    }
};

const getPaymentById = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { paymentId } = req.params;

        if (!paymentId) {
            return sendError(res, 'Payment ID is required', null, 400);
        }

        const { realmId } = req.qbAuth!;

        // Get payment through service
        const payment = await paymentSyncService.getPaymentById(paymentId, realmId);

        return sendSuccess(res, 'Payment retrieved successfully', { payment });

    } catch (error) {
        console.error('Error getting payment by ID:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to get payment',
            { 
                error: error instanceof Error ? error.message : 'Unknown error',
                paymentId: req.params?.paymentId
            },
            statusCode
        );
    }
};

const updatePaymentInvoiceMappings = async (req: Request, res: Response): Promise<Response> => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', {
                errors: errors.array()
            }, 400);
        }

        const { accessToken, realmId } = req.qbAuth!;

        console.log(`🔄 Starting payment invoice mapping update for realm: ${realmId}`);

        // Update payment invoice mappings through service
        const updateResult = await paymentSyncService.updatePaymentInvoiceMappings(accessToken, realmId);

        if (updateResult.success) {
            return sendSuccess(res, updateResult.message, {
                totalProcessed: updateResult.totalProcessed,
                updatedCount: updateResult.updatedCount,
                skippedCount: updateResult.totalProcessed - updateResult.updatedCount
            });
        } else {
            return sendError(res, updateResult.message, {
                totalProcessed: updateResult.totalProcessed,
                updatedCount: updateResult.updatedCount
            }, 500);
        }

    } catch (error) {
        console.error('Error updating payment invoice mappings:', error);
        const statusCode = getStatusCode(error as Error);
        return sendError(
            res,
            'Failed to update payment invoice mappings',
            {
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            statusCode
        );
    }
};

export {
    syncSinglePayment,
    syncAllPayments,
    getPaymentSyncStatus,
    getAllPaymentsSyncStatus,
    getPaymentSyncStatistics,
    getPayments,
    getPaymentById,
    updatePaymentInvoiceMappings
};
