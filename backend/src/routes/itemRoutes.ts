// routes/itemRoutes.ts

import { Router } from 'express';
import { itemController } from '../controller/itemController';
import { quickbooksAuthMiddleware } from '../middleware/authMiddleware';
const itemRoutes = Router();

// Apply QuickBooks auth middleware to all routes
itemRoutes.use(quickbooksAuthMiddleware);

itemRoutes.post('/sync', itemController.syncItems);

itemRoutes.get('/', itemController.getItems);


itemRoutes.get('/stats', itemController.getItemStats);


itemRoutes.get('/inventory', itemController.getInventoryItems);


itemRoutes.get('/types', itemController.getItemTypes);


itemRoutes.get('/type-summary', itemController.getItemTypeSummary);


itemRoutes.get('/search', itemController.searchItems);


itemRoutes.get('/:itemId', itemController.getItemById);

export default itemRoutes;