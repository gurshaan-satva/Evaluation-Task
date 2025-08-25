// routes/quickbooksAuthRoutes.ts

import { Router } from 'express';
import { quickbooksAuthController } from '../controller/quickbooksAuthController';

const authRoutes = Router();

authRoutes.get('/connect', quickbooksAuthController.qboConnect);


authRoutes.get('/callback', quickbooksAuthController.qboCallback);


authRoutes.post('/refresh', quickbooksAuthController.qboRefresh);

authRoutes.post('/disconnect', quickbooksAuthController.qboDisconnect);


authRoutes.get('/status/:connectionId', quickbooksAuthController.qboStatus);


authRoutes.get('/connections', quickbooksAuthController.qboConnections);


authRoutes.post('/test/:connectionId', quickbooksAuthController.qboTestConnection);

export default authRoutes;