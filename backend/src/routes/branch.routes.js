const express = require('express')
const router = express.Router()
const { protect, authorize } = require('../middleware/auth.middleware')
const {
  getAllBranches,
  getBranchById,
  createBranch,
  updateBranch,
  assignEmployee
} = require('../controllers/branch.controller')

router.get('/', protect, getAllBranches)
router.get('/:id', protect, getBranchById)
router.post('/', protect, authorize('ADMIN'), createBranch)
router.put('/:id', protect, authorize('ADMIN'), updateBranch)
router.put('/:id/assign', protect, authorize('ADMIN', 'SUPERVISOR'), assignEmployee)

module.exports = router