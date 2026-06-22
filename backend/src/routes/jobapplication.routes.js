const express = require('express')
const router = express.Router()
const { protect, authorize } = require('../middleware/auth.middleware')
const {
  submitApplication,
  getAllApplications,
  getApplicationById,
  updateApplicationStatus,
  deleteApplication
} = require('../controllers/jobapplication.controller')  // capital J

// Public — anyone can apply via the "Join Our Crew" page, no login required
router.post('/', submitApplication)

// Admin/Supervisor — review applications
router.get('/', protect, authorize('ADMIN', 'SUPERVISOR'), getAllApplications)
router.get('/:id', protect, authorize('ADMIN', 'SUPERVISOR'), getApplicationById)
router.put('/:id/status', protect, authorize('ADMIN', 'SUPERVISOR'), updateApplicationStatus)
router.delete('/:id', protect, authorize('ADMIN'), deleteApplication)

module.exports = router