"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireSuperAdmin = exports.requireAdmin = exports.requireAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const requireAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            if (req.resolvedTenantId) {
                return next();
            }
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const token = authHeader.split(' ')[1];
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'supersecret');
        req.user = decoded;
        next();
    }
    catch (err) {
        if (req.resolvedTenantId) {
            return next();
        }
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};
exports.requireAuth = requireAuth;
const requireAdmin = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'supersecret');
            req.user = decoded;
            if (decoded.role !== 'admin' && decoded.role !== 'super_admin') {
                res.status(403).json({ error: 'Access denied: Admin privilege required' });
                return;
            }
            return next();
        }
        if (req.resolvedTenantId) {
            return next();
        }
        res.status(401).json({ error: 'Authentication required' });
    }
    catch (err) {
        if (req.resolvedTenantId) {
            return next();
        }
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};
exports.requireAdmin = requireAdmin;
const requireSuperAdmin = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const token = authHeader.split(' ')[1];
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'supersecret');
        req.user = decoded;
        if (decoded.role !== 'super_admin') {
            res.status(403).json({ error: 'Access denied: Super Admin privilege required' });
            return;
        }
        next();
    }
    catch (err) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};
exports.requireSuperAdmin = requireSuperAdmin;
