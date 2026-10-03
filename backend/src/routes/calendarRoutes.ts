import { Router } from 'express';
import {
  getDayTypes,
  getCalendarMonth,
  setCalendarDay,
  batchSetCalendarDays,
  getCalendarEvents,
  setCalendarEvents,
  getSupervisorReminders,
} from '../controllers/calendarController';

const router = Router();

router.get('/day-types', getDayTypes);
router.get('/', getCalendarMonth);
router.post('/set-day', setCalendarDay);
router.post('/batch-set', batchSetCalendarDays);
router.get('/events', getCalendarEvents);
router.post('/events', setCalendarEvents);
router.get('/supervisor-reminders', getSupervisorReminders);

export default router;
