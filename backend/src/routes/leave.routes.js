const express = require('express')
const router = express.Router()
const { protect, authorize } = require('../middleware/auth.middleware')
const {
  applyLeave,
  getMyLeave,
  getAllLeave,
  approveLeave,
  rejectLeave,
  cancelLeave
} = require('../controllers/leave.controller')

router.post('/', protect, applyLeave)
router.get('/my', protect, getMyLeave)
router.get('/', protect, authorize('ADMIN', 'SUPERVISOR'), getAllLeave)
router.put('/:id/approve', protect, authorize('ADMIN', 'SUPERVISOR'), approveLeave)
router.put('/:id/reject', protect, authorize('ADMIN', 'SUPERVISOR'), rejectLeave)
router.delete('/:id', protect, cancelLeave)

module.exports = router