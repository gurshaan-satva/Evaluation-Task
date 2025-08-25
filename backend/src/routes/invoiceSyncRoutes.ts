// routes/invoiceSyncRoutes.ts

import { Router } from 'express';
import { invoiceSyncController } from '../controller/invoiceSyncController';
import { quickbooksAuthMiddleware } from '../middleware/authMiddleware';
import {
    validateSyncSingleInvoice,
    validateSyncAllInvoices,
    validateGetInvoiceSyncStatus,
    validateGetAllInvoicesSyncStatus,
    validateRetryInvoiceSync
} from '../middleware/invoiceSyncValidation';

const invoiceSyncRoutes = Router();

// Apply QuickBooks auth middleware to all routes
invoiceSyncRoutes.use(quickbooksAuthMiddleware);


invoiceSyncRoutes.post(
    '/sync',
    validateSyncAllInvoices,
    invoiceSyncController.syncAllInvoices
);

invoiceSyncRoutes.post(
    '/sync/:invoiceId',
    validateSyncSingleInvoice,
    invoiceSyncController.syncSingleInvoice
);

invoiceSyncRoutes.get(
    '/sync/status',
    validateGetAllInvoicesSyncStatus,
    invoiceSyncController.getAllInvoicesSyncStatus
);


invoiceSyncRoutes.get(
    '/sync/:invoiceId/status',
    validateGetInvoiceSyncStatus,
    invoiceSyncController.getInvoiceSyncStatus
);

invoiceSyncRoutes.get(
    '/', 
    invoiceSyncController.getInvoices);

invoiceSyncRoutes.get(
    '/:invoiceId', 
    invoiceSyncController.getInvoiceById);






export default invoiceSyncRoutes;