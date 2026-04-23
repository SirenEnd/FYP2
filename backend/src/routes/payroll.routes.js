const express = require('express')
const router = express.Router()
const { protect, authorize } = require('../middleware/auth.middleware')
const {
  generatePayroll,
  getAllPayroll,
  getMyPayroll,
  getPayrollById,
  markAsPaid
} = require('../controllers/payroll.controller')

router.post('/generate', protect, authorize('ADMIN'), generatePayroll)
router.get('/', protect, authorize('ADMIN', 'SUPERVISOR'), getAllPayroll)
router.get('/my', protect, getMyPayroll)
router.get('/:id', protect, getPayrollById)
router.put('/:id/pay', protect, authorize('ADMIN'), markAsPaid)

module.exports = router