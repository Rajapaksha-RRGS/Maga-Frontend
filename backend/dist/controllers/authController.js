"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const SECRET_KEY = process.env.JWT_SECRET;
const login = async (req, res) => {
    try {
        const { tenantId, username, password } = req.body;
        // validation 
        if (!tenantId || !username || !password) {
            res.status(400).json({ error: "Please provide tenant, username and password" });
            return;
        }
        const tenant = await prisma_1.default.tenant.findUnique({
            where: { id: tenantId }
        });
        if (!tenant || tenant.status !== 'active') {
            res.status(400).json({ error: "Invalid Tenant orInactive Tenant" });
            return;
        }
        // check for user
        const user = await prisma_1.default.user.findUnique({
            where: { tenantId_username: { tenantId, username } }
        });
        // if no user
        if (!user || user.status !== 'active') {
            res.status(401).json({ error: "Invalid Credentials" });
            return;
        }
        //compare password
        const isMatch = await bcrypt_1.default.compare(password, user.passwordHash);
    }
    catch (error) {
    }
};
exports.login = login;
