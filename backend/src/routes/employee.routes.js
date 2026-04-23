const express = require('express')
const router = express.Router()
const { protect, authorize } = require('../middleware/auth.middleware')
const {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getStaffList
} = require('../controllers/employee.controller')

// IMPORTANT: Put specific routes BEFORE the /:id route
router.get('/staff', protect, getStaffList)  // Temporarily remove authorize for testing
router.get('/test-staff', protect, (req, res) => {
  res.json({ message: 'Test works', user: req.user })
})
router.get('/', protect, authorize('ADMIN', 'SUPERVISOR'), getAllEmployees)
router.get('/:id', protect, getEmployeeById)
router.post('/', protect, authorize('ADMIN'), createEmployee)
router.put('/:id', protect, authorize('ADMIN'), updateEmployee)
router.delete('/:id', protect, authorize('ADMIN'), deleteEmployee)

module.exports = router