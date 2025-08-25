// middleware/invoiceSyncValidation.ts

import { body, param, query } from 'express-validator';

/**
 * Validation for syncing a single invoice
 * POST /api/v1/qbo/invoices/sync/:invoiceId
 */
export const validateSyncSingleInvoice = [
    param('invoiceId')
        .notEmpty()
        .withMessage('Invoice ID is required')
        .isString()
        .withMessage('Invoice ID must be a string')
        .isLength({ min: 1, max: 50 })
        .withMessage('Invoice ID must be between 1 and 50 characters')
];

/**
 * Validation for syncing all invoices
 * POST /api/v1/qbo/invoices/sync
 */
export const validateSyncAllInvoices = [
];

/**
 * Validation for getting invoice sync status
 * GET /api/v1/qbo/invoices/sync/:invoiceId/status
 */
export const validateGetInvoiceSyncStatus = [
    param('invoiceId')
        .notEmpty()
        .withMessage('Invoice ID is required')
        .isString()
        .withMessage('Invoice ID must be a string')
        .isLength({ min: 1, max: 50 })
        .withMessage('Invoice ID must be between 1 and 50 characters')
];

/**
 * Validation for getting all invoices sync status
 * GET /api/v1/qbo/invoices/sync/status
 */
export const validateGetAllInvoicesSyncStatus = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    
    query('syncStatus')
        .optional()
        .isIn(['PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED', 'RETRY', 'CANCELLED'])
        .withMessage('syncStatus must be one of: PENDING, IN_PROGRESS, SUCCESS, FAILED, RETRY, CANCELLED'),
    
    query('status')
        .optional()
        .isIn(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED', 'VOID'])
        .withMessage('status must be one of: DRAFT, SENT, PAID, OVERDUE, CANCELLED, VOID'),
    
    query('dateFrom')
        .optional()
        .isISO8601()
        .withMessage('dateFrom must be a valid ISO 8601 date'),
    
    query('dateTo')
        .optional()
        .isISO8601()
        .withMessage('dateTo must be a valid ISO 8601 date')
];

/**
 * Validation for retrying invoice sync
 * POST /api/v1/qbo/invoices/sync/:invoiceId/retry
 */
export const validateRetryInvoiceSync = [
    param('invoiceId')
        .notEmpty()
        .withMessage('Invoice ID is required')
        .isString()
        .withMessage('Invoice ID must be a string')
        .isLength({ min: 1, max: 50 })
        .withMessage('Invoice ID must be between 1 and 50 characters'),
    
    body('forceRetry')
        .optional()
        .isBoolean()
        .withMessage('forceRetry must be a boolean')
];

/**
 * Validation for bulk invoice sync
 * POST /api/v1/qbo/invoices/sync/bulk
 */
export const validateBulkInvoiceSync = [
    body('invoiceIds')
        .isArray({ min: 1, max: 50 })
        .withMessage('invoiceIds must be an array with 1-50 items'),
    
    body('invoiceIds.*')
        .isString()
        .withMessage('Each invoice ID must be a string')
        .isLength({ min: 1, max: 50 })
        .withMessage('Each invoice ID must be between 1 and 50 characters'),
    
    body('forceSync')
        .optional()
        .isBoolean()
        .withMessage('forceSync must be a boolean'),
    
    body('stopOnError')
        .optional()
        .isBoolean()
        .withMessage('stopOnError must be a boolean')
];

/**
 * Validation for getting sync logs
 * GET /api/v1/qbo/invoices/sync/logs
 */
export const validateGetSyncLogs = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    
    query('status')
        .optional()
        .isIn(['PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED', 'RETRY', 'CANCELLED'])
        .withMessage('status must be one of: PENDING, IN_PROGRESS, SUCCESS, FAILED, RETRY, CANCELLED'),
    
    query('operation')
        .optional()
        .isIn(['CREATE', 'UPDATE', 'DELETE', 'READ'])
        .withMessage('operation must be one of: CREATE, UPDATE, DELETE, READ'),
    
    query('invoiceId')
        .optional()
        .isString()
        .withMessage('invoiceId must be a string')
        .isLength({ min: 1, max: 50 })
        .withMessage('invoiceId must be between 1 and 50 characters'),
    
    query('dateFrom')
        .optional()
        .isISO8601()
        .withMessage('dateFrom must be a valid ISO 8601 date'),
    
    query('dateTo')
        .optional()
        .isISO8601()
        .withMessage('dateTo must be a valid ISO 8601 date')
];