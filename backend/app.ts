import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { router } from './src/routes';

dotenv.config();
const app = express();

// Body parsing middleware MUST come BEFORE routes
app.use(express.json()); // Move this up
app.use(express.urlencoded({ extended: true }));

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
}));

// Routes come AFTER middleware
app.use('/api/v1/qbo', router);

export default app;