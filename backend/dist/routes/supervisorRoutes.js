"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supervisorController_1 = require("../controllers/supervisorController");
const router = (0, express_1.Router)();
router.get('/', supervisorController_1.getAllSupervisors);
router.post('/', supervisorController_1.createSupervisor);
// Password reset endpoints (support both conventions)
router.put('/:id/resetPassword', supervisorController_1.resetSupervisorPassword);
router.post('/:id/reset-password', supervisorController_1.resetSupervisorPassword);
router.put('/:id/reset-password', supervisorController_1.resetSupervisorPassword);
// Status update endpoints (support both conventions)
router.put('/:id/updateStatus', supervisorController_1.updateSupervisorStatus);
router.patch('/:id/status', supervisorController_1.updateSupervisorStatus);
router.put('/:id/status', supervisorController_1.updateSupervisorStatus);
// Delete supervisor
router.delete('/:id', supervisorController_1.deleteSupervisor);
exports.default = router;
