const express = require('express')
const router = express.Router()
const { protect, authorize } = require('../middleware/auth.middleware')
const {
  generatePayroll, getAllPayroll, getMyPayroll, getPayrollById,
  markAsPaid, deletePayroll, requestAdvance, approveAdvance, rejectAdvance,
  getAllAdvances, getMyAdvances
} = require('../controllers/payroll.controller')

router.post('/generate',             protect, authorize('ADMIN'), generatePayroll)
router.get('/',                      protect, authorize('ADMIN', 'SUPERVISOR'), getAllPayroll)
router.get('/my',                    protect, getMyPayroll)
router.get('/advances',              protect, authorize('ADMIN', 'SUPERVISOR'), getAllAdvances)
router.get('/advances/my',           protect, getMyAdvances)
router.post('/advance',              protect, requestAdvance)
router.put('/advance/:id/approve',   protect, authorize('ADMIN', 'SUPERVISOR'), approveAdvance)
router.put('/advance/:id/reject',    protect, authorize('ADMIN', 'SUPERVISOR'), rejectAdvance)
router.get('/:id',                   protect, getPayrollById)
router.put('/:id/pay',               protect, authorize('ADMIN'), markAsPaid)
router.delete('/:id',                protect, authorize('ADMIN'), deletePayroll)

module.exports = router