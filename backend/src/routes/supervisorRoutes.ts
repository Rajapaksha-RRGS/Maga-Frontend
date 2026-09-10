import { Router } from "express";
import {
  getAllSupervisors,
  createSupervisor,
  resetSupervisorPassword,
  updateSupervisorStatus,
  deleteSupervisor,
} from "../controllers/supervisorController";

const router: Router = Router();

router.get('/', getAllSupervisors);
router.post('/', createSupervisor);

// Password reset endpoints (support both conventions)
router.put('/:id/resetPassword', resetSupervisorPassword);
router.post('/:id/reset-password', resetSupervisorPassword);
router.put('/:id/reset-password', resetSupervisorPassword);

// Status update endpoints (support both conventions)
router.put('/:id/updateStatus', updateSupervisorStatus);
router.patch('/:id/status', updateSupervisorStatus);
router.put('/:id/status', updateSupervisorStatus);

// Delete supervisor
router.delete('/:id', deleteSupervisor);

export default router;