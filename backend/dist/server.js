"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const employeeRoutes_1 = __importDefault(require("./routes/employeeRoutes"));
const businessPartnerRoutes_1 = __importDefault(require("./routes/businessPartnerRoutes"));
const activityCodeRoutes_1 = __importDefault(require("./routes/activityCodeRoutes"));
const timeEntryRoutes_1 = __importDefault(require("./routes/timeEntryRoutes"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const supervisorRoutes_1 = __importDefault(require("./routes/supervisorRoutes"));
const assignmentRoutes_1 = __importDefault(require("./routes/assignmentRoutes"));
const reportRoutes_1 = __importDefault(require("./routes/reportRoutes"));
const equipmentRoutes_1 = __importDefault(require("./routes/equipmentRoutes"));
const calendarRoutes_1 = __importDefault(require("./routes/calendarRoutes"));
const tenantRoutes_1 = __importDefault(require("./routes/tenantRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Middlewares
app.use((0, cors_1.default)({
    origin: [
        'https://v0-shaders-landing-page-pearl-xi.vercel.app', // Frontend URL එක
        'http://localhost:5173',
        'http://localhost:3000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express_1.default.json());
// API Routes
app.use('/api/auth', authRoutes_1.default);
app.use('/api/supervisors', supervisorRoutes_1.default);
app.use('/api/assignments', assignmentRoutes_1.default);
app.use('/api/employees', employeeRoutes_1.default);
app.use('/api/business-partners', businessPartnerRoutes_1.default);
app.use('/api/activity-codes', activityCodeRoutes_1.default);
app.use('/api/time-entries', timeEntryRoutes_1.default);
app.use('/api/reports', reportRoutes_1.default);
app.use('/api/equipment', equipmentRoutes_1.default);
app.use('/api/calendar', calendarRoutes_1.default);
app.use('/api/tenants', tenantRoutes_1.default);
app.get('/', (req, res) => {
    res.json({ status: "success", message: "Maga Backend API is running perfectly!" });
});
// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Mäga Engineering Backend API is running successfully!',
        timestamp: new Date().toISOString(),
    });
});
// 404 Handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});
app.listen(PORT, () => {
    console.log(`🚀 Mäga Backend server running on http://localhost:${PORT}`);
    console.log(`📋 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`👥 Employees API: http://localhost:${PORT}/api/employees`);
});
exports.default = app;
