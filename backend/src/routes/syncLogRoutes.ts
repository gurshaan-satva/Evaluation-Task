import { Router } from 'express';
import { syncLogController } from '../controller/syncLogController';
import { quickbooksAuthMiddleware } from '../middleware/authMiddleware';

const syncLogRoutes = Router();

// Apply QuickBooks auth middleware to all routes
syncLogRoutes.use(quickbooksAuthMiddleware);

syncLogRoutes.get('/', syncLogController.getSyncLogs);

syncLogRoutes.get('/:syncLogId', syncLogController.getSyncLogById);

syncLogRoutes.get('/transaction/:transactionId', syncLogController.getSyncLogsByTransactionId);

export default syncLogRoutes;