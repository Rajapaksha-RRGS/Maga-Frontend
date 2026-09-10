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

// Middlewares
app.use(cors());
app.use(express.json());

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

app.use(cors({
  origin: [
    'https://v0-shaders-landing-page-pearl-xi.vercel.app', // Frontend URL එක
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

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