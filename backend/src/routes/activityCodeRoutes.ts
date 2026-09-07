import { Router } from 'express';
import {
  getAllActivityCodes,
  getActivityCodeById,
  createActivityCode,
  updateActivityCode,
  deleteActivityCode,
} from '../controllers/activityCodeController';

const router = Router();

router.get('/', getAllActivityCodes);
router.get('/:id', getActivityCodeById);
router.post('/', createActivityCode);
router.put('/:id', updateActivityCode);
router.delete('/:id', deleteActivityCode);

export default router;
