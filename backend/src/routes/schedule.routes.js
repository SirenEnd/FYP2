const express = require('express')
const router = express.Router()
const { protect, authorize } = require('../middleware/auth.middleware')
const {
  createSchedule,
  getSchedules,
  getMySchedule,
  updateSchedule,
  deleteSchedule,
  getWeekSchedule
} = require('../controllers/schedule.controller')

router.post('/', protect, authorize('ADMIN', 'SUPERVISOR'), createSchedule)
router.get('/', protect, authorize('ADMIN', 'SUPERVISOR'), getSchedules)
router.get('/my', protect, getMySchedule)
router.get('/week', protect, getWeekSchedule)
router.put('/:id', protect, authorize('ADMIN', 'SUPERVISOR'), updateSchedule)
router.delete('/:id', protect, authorize('ADMIN', 'SUPERVISOR'), deleteSchedule)

module.exports = router