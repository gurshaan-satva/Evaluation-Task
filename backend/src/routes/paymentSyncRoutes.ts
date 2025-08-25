// routes/paymentSyncRoutes.ts

import express from 'express';
import {
    syncSinglePayment,
    syncAllPayments,
    getPaymentSyncStatus,
    getAllPaymentsSyncStatus,
    getPaymentSyncStatistics,
    getPayments,
    getPaymentById,
    updatePaymentInvoiceMappings
} from '../controller/paymentSyncController';
import { quickbooksAuthMiddleware } from '../middleware/authMiddleware';
import {
    validatePaymentSyncRequest,
    validatePaymentSyncStatusQuery
} from '../middleware/paymentSyncValidation';

const paymentSyncRoutes = express.Router();

// Apply QuickBooks authentication middleware to all routes
paymentSyncRoutes.use(quickbooksAuthMiddleware);

paymentSyncRoutes.post('/sync/:paymentId', validatePaymentSyncRequest, syncSinglePayment);

paymentSyncRoutes.post('/sync', syncAllPayments);

paymentSyncRoutes.post('/update-invoice-mappings', updatePaymentInvoiceMappings);

paymentSyncRoutes.get('/:paymentId/sync-status', validatePaymentSyncRequest, getPaymentSyncStatus);

paymentSyncRoutes.get('/sync/status', validatePaymentSyncStatusQuery, getAllPaymentsSyncStatus);

paymentSyncRoutes.get('/sync-statistics', getPaymentSyncStatistics);

paymentSyncRoutes.get('/', getPayments);

paymentSyncRoutes.get('/:paymentId', getPaymentById);


export default paymentSyncRoutes;
