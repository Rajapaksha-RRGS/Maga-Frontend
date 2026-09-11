import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import employeeRoutes from './routes/employeeRoutes';
import businessPartnerRoutes from './routes/businessPartnerRoutes';
import activityCodeRoutes from './routes/activityCodeRoutes';
import timeEntryRoutes from './routes/timeEntryRoutes';
import authRoutes from './routes/authRoutes';
import supervisorRoutes from './routes/supervisorRoutes';
import assignmentRoutes from './routes/assignmentRoutes';
import reportRoutes from './routes/reportRoutes';
import equipmentRoutes from './routes/equipmentRoutes';
import calendarRoutes from './routes/calendarRoutes';
import tenantRoutes from './routes/tenantRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Crash-proof CORS Middleware
app.use(cors({
  origin: true, // Automatically reflects request origin (Vercel, localhost, etc.)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Tenant-Id', 'x-tenant-id'],
}));

// 2. Preflight (OPTIONS) requests handler (Express 5 safe - avoids app.options('*') crash)
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, X-Tenant-Id, x-tenant-id');
    res.header('Access-Control-Allow-Credentials', 'true');
    return res.status(200).end();
  }
  next();
});

app.use(express.json());

import { resolveTenantMiddleware } from './middleware/tenantMiddleware';
app.use(resolveTenantMiddleware);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/supervisors', supervisorRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/business-partners', businessPartnerRoutes);
app.use('/api/activity-codes', activityCodeRoutes);
app.use('/api/time-entries', timeEntryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/tenants', tenantRoutes);

app.get('/', (req, res) => {
  res.json({ status: "success", message: "Maga Backend API is running perfectly!" });
});

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'Mäga Engineering Backend API is running successfully!',
    timestamp: new Date().toISOString(),
  });
});

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Mäga Backend server running on http://localhost:${PORT}`);
  console.log(`📋 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`👥 Employees API: http://localhost:${PORT}/api/employees`);
});

export default app;