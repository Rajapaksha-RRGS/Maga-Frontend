import { Router } from 'express';
import {
  getDayTypes,
  getCalendarMonth,
  setCalendarDay,
  batchSetCalendarDays,
} from '../controllers/calendarController';

const router = Router();

router.get('/day-types', getDayTypes);
router.get('/', getCalendarMonth);
router.post('/set-day', setCalendarDay);
router.post('/batch-set', batchSetCalendarDays);

export default router;
