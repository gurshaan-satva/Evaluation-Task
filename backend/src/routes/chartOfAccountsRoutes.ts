// routes/chartOfAccountsRoutes.ts

import { Router } from 'express';
import { quickbooksAuthMiddleware } from '../middleware/authMiddleware';
import { chartOfAccountsController } from '../controller/chartOfAccountsController';


const accountsRoutes = Router();

// Apply QuickBooks auth middleware to all routes
accountsRoutes.use(quickbooksAuthMiddleware);


accountsRoutes.post('/sync', chartOfAccountsController.syncChartOfAccounts);


accountsRoutes.get('/', chartOfAccountsController.getChartOfAccounts);


accountsRoutes.get('/stats', chartOfAccountsController.getChartOfAccountsStats);


accountsRoutes.get('/types', chartOfAccountsController.getAccountTypes);

export default accountsRoutes;