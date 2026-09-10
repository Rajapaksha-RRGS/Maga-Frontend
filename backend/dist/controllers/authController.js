"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const SECRET_KEY = process.env.JWT_SECRET;
const login = async (req, res) => {
    console.log("API CALLED");
    try {
        const { tenantId, username, password } = req.body;
        // validation 
        if (!tenantId || !username || !password) {
            res.status(400).json({ error: "Please provide tenant, username and password" });
            return;
        }
        const cleanTenant = String(tenantId).trim();
        const cleanUsername = String(username).trim().toLowerCase();
        const tenant = await prisma_1.default.tenant.findUnique({
            where: { subdomain: cleanTenant }
        });
        if (!tenant || tenant.status !== 'active') {
            res.status(400).json({ error: "Invalid Tenant or Inactive Tenant" });
            return;
        }
        // check for user
        const user = await prisma_1.default.user.findUnique({
            where: {
                tenantId_username: { tenantId: tenant.id, username: cleanUsername }
            }
        });
        // if no user
        if (!user || user.status !== 'active') {
            res.status(401).json({ error: "Invalid Credentials" });
            return;
        }
        //compare password
        const isMatch = await bcrypt_1.default.compare(password, user.passwordHash);
        if (!isMatch) {
            res.status(401).json({ error: "Invalid Credentials" });
            return;
        }
        const token = jsonwebtoken_1.default.sign({
            userId: user.id,
            tenantId: tenant.id,
            role: user.role,
            fullName: user.fullName,
            companyName: tenant.companyName,
        }, SECRET_KEY || 'supersecret', {
            expiresIn: '1h'
        });
        // Remove password hash before sending user data
        const { passwordHash, ...safeUser } = user;
        res.json({
            success: true,
            message: "Login Successful",
            token: token,
            user: {
                ...safeUser,
                companyName: tenant.companyName,
            }
        });
        return;
    }
    catch (error) {
        console.error('Login failed:', error);
        res.status(500).json({ error: 'Internal server error during login' });
        return;
    }
};
exports.login = login;
