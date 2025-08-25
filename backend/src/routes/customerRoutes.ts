// routes/customerRoutes.ts

import { Router } from 'express';
import { customerController } from '../controller/customerController';
import { quickbooksAuthMiddleware } from '../middleware/authMiddleware';

const customerRoutes = Router();

// Apply QuickBooks auth middleware to all routes
customerRoutes.use(quickbooksAuthMiddleware);


customerRoutes.post('/sync', customerController.syncCustomers);


customerRoutes.get('/', customerController.getCustomers);


customerRoutes.get('/stats', customerController.getCustomerStats);


customerRoutes.get('/search', customerController.searchCustomers);


customerRoutes.get('/:customerId', customerController.getCustomerById);

export default customerRoutes;