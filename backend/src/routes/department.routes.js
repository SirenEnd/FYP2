const express = require('express')
const router = express.Router()
const { protect, authorize } = require('../middleware/auth.middleware')
const { getAllDepartments, createDepartment } = require('../controllers/department.controller')

router.get('/', protect, getAllDepartments)
router.post('/', protect, authorize('ADMIN'), createDepartment)

module.exports = router