const express = require('express')
const router = express.Router()
const { protect, authorize } = require('../middleware/auth.middleware')
const { getTasks, getMyTasks, createTask, updateTask, deleteTask } = require('../controllers/task.controller')

router.get('/', protect, authorize('ADMIN', 'SUPERVISOR'), getTasks)
router.get('/my', protect, getMyTasks)
router.post('/', protect, authorize('ADMIN', 'SUPERVISOR'), createTask)
router.put('/:id', protect, authorize('ADMIN', 'SUPERVISOR'), updateTask)
router.delete('/:id', protect, authorize('ADMIN', 'SUPERVISOR'), deleteTask)

module.exports = router