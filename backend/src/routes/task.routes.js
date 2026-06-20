const express = require('express')
const router = express.Router()
const { protect, authorize } = require('../middleware/auth.middleware')
const { getTasks, getMyTasks, createTask, updateTask, deleteTask,updateMyTaskStatus } = require('../controllers/task.controller')

router.get('/', protect, authorize('ADMIN', 'SUPERVISOR'), getTasks)
router.get('/my', protect, getMyTasks)
router.put('/my/:id/status', protect, updateMyTaskStatus)
router.post('/', protect, authorize('ADMIN', 'SUPERVISOR'), createTask)
router.put('/:id', protect, authorize('ADMIN', 'SUPERVISOR'), updateTask)
router.delete('/:id', protect, authorize('ADMIN', 'SUPERVISOR'), deleteTask)



module.exports = router