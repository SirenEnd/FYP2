const express = require('express')
const router = express.Router()
const { protect, authorize } = require('../middleware/auth.middleware')
const {
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  getToday,
  getReport,
  getMyHistory
} = require('../controllers/attendance.controller')

router.post('/clockin', protect, clockIn)
router.post('/clockout', protect, clockOut)
router.post('/break/start', protect, startBreak)
router.post('/break/end', protect, endBreak)
router.get('/today', protect, getToday)
router.get('/my', protect, getMyHistory)
router.get('/report', protect, authorize('ADMIN', 'SUPERVISOR'), getReport)

module.exports = router