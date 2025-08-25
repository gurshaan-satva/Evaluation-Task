// middleware/paymentSyncValidation.ts

import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/responseHandler';

/**
 * Validate payment sync request parameters
 */
export const validatePaymentSyncRequest = (req: Request, res: Response, next: NextFunction): void => {
    try {
        const { paymentId } = req.params;

        // Validate payment ID
        if (!paymentId) {
            sendError(res, 'Payment ID is required', { field: 'paymentId' }, 400);
            return;
        }

        if (typeof paymentId !== 'string' || paymentId.trim().length === 0) {
            sendError(res, 'Payment ID must be a valid non-empty string', { field: 'paymentId', value: paymentId }, 400);
            return;
        }

        // Validate payment ID format (assuming CUID format)
        const cuidPattern = /^[a-z0-9]{25}$/;
        if (!cuidPattern.test(paymentId)) {
            sendError(res, 'Payment ID must be a valid CUID format', { field: 'paymentId', value: paymentId }, 400);
            return;
        }

        next();
    } catch (error) {
        console.error('Error in payment sync validation middleware:', error);
        sendError(res, 'Validation error occurred', { error: error instanceof Error ? error.message : 'Unknown error' }, 500);
    }
};



/**
 * Validate payment sync status query parameters
 */
export const validatePaymentSyncStatusQuery = (req: Request, res: Response, next: NextFunction): void => {
    try {
        const { page, limit, syncStatus, status, dateFrom, dateTo } = req.query;

        // Validate page
        if (page !== undefined) {
            const pageNum = parseInt(page as string);
            if (isNaN(pageNum) || pageNum < 1) {
                sendError(res, 'Page must be a positive integer', { field: 'page', value: page }, 400);
                return;
            }
        }

        // Validate limit
        if (limit !== undefined) {
            const limitNum = parseInt(limit as string);
            if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
                sendError(res, 'Limit must be a number between 1 and 100', { field: 'limit', value: limit }, 400);
                return;
            }
        }

        // Validate syncStatus
        if (syncStatus !== undefined) {
            const validSyncStatuses = ['PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED'];
            if (!validSyncStatuses.includes(syncStatus as string)) {
                sendError(res, 'Invalid sync status', { 
                    field: 'syncStatus', 
                    value: syncStatus, 
                    validValues: validSyncStatuses 
                }, 400);
                return;
            }
        }

        // Validate status
        if (status !== undefined) {
            const validStatuses = ['PENDING', 'COMPLETED', 'CANCELLED'];
            if (!validStatuses.includes(status as string)) {
                sendError(res, 'Invalid payment status', { 
                    field: 'status', 
                    value: status, 
                    validValues: validStatuses 
                }, 400);
                return;
            }
        }

        // Validate date formats
        if (dateFrom !== undefined) {
            const date = new Date(dateFrom as string);
            if (isNaN(date.getTime())) {
                sendError(res, 'Invalid dateFrom format. Use YYYY-MM-DD', { field: 'dateFrom', value: dateFrom }, 400);
                return;
            }
        }

        if (dateTo !== undefined) {
            const date = new Date(dateTo as string);
            if (isNaN(date.getTime())) {
                sendError(res, 'Invalid dateTo format. Use YYYY-MM-DD', { field: 'dateTo', value: dateTo }, 400);
                return;
            }
        }

        // Validate date range
        if (dateFrom && dateTo) {
            const fromDate = new Date(dateFrom as string);
            const toDate = new Date(dateTo as string);
            if (fromDate > toDate) {
                sendError(res, 'dateFrom must be earlier than or equal to dateTo', { 
                    dateFrom, 
                    dateTo 
                }, 400);
                return;
            }
        }

        next();
    } catch (error) {
        console.error('Error in payment sync status query validation middleware:', error);
        sendError(res, 'Validation error occurred', { error: error instanceof Error ? error.message : 'Unknown error' }, 500);
    }
};
