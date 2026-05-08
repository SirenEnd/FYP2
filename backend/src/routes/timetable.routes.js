const express = require('express')
const router = express.Router()
const { protect, authorize } = require('../middleware/auth.middleware')
const {
  createTimetable,
  getActiveTimetable,
  assignSlot,
  removeSlot,
  getMySchedule,
  getAllTimetables
} = require('../controllers/timetable.controller')

router.get('/', protect, authorize('ADMIN', 'SUPERVISOR'), getAllTimetables)
router.post('/', protect, authorize('ADMIN', 'SUPERVISOR'), createTimetable)
router.get('/my', protect, getMySchedule)
router.get('/branch/:branchId', protect, getActiveTimetable)
router.post('/:id/slot', protect, authorize('ADMIN', 'SUPERVISOR'), assignSlot)
router.delete('/slot/:slotId', protect, authorize('ADMIN', 'SUPERVISOR'), removeSlot)

module.exports = router