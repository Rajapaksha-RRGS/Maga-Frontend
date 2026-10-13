"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const router = (0, express_1.Router)();
// Ensure upload directory exists
const uploadDir = path_1.default.join(__dirname, '../../uploads/documents');
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
// Multer storage configuration
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        const timestamp = Date.now();
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${timestamp}-${sanitizedName}`);
    },
});
// File filter: accept PDFs and document scan images
const fileFilter = (_req, file, cb) => {
    const allowedMimes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
    ];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error('Invalid file type. Only PDF and Image documents (JPG, PNG, WebP) are allowed.'));
    }
};
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 20 * 1024 * 1024, // 20 MB max file size
    },
    fileFilter,
});
// POST /api/uploads/document — Upload single combined dossier document
router.post('/document', upload.single('document'), (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No document file uploaded' });
            return;
        }
        // Return relative URL that is statically served
        const fileUrl = `/uploads/documents/${req.file.filename}`;
        res.json({
            success: true,
            fileUrl,
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype,
        });
    }
    catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({ error: error.message || 'Failed to process document upload' });
    }
});
exports.default = router;
