import { Router } from 'express';
import authRoutes from './quickbooksAuthRoutes';
import accountsRoutes from './chartOfAccountsRoutes';
import customerRoutes from './customerRoutes';
import itemRoutes from './itemRoutes';
import invoiceSyncRoutes from './invoiceSyncRoutes';
import paymentSyncRoutes from './paymentSyncRoutes';
import syncLogRoutes from './syncLogRoutes';
import { qboTokenRefreshMiddleware } from '../middleware/tokenRefreshMiddleware';


export const router = Router();

router.use("/auth", authRoutes);

router.use("/", qboTokenRefreshMiddleware);

router.use("/accounts", accountsRoutes);
router.use("/customers", customerRoutes);
router.use("/items", itemRoutes);
router.use("/invoices", invoiceSyncRoutes);
router.use("/payments", paymentSyncRoutes);
router.use("/sync-logs", syncLogRoutes);