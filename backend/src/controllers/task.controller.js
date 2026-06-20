const prisma = require('../utils/prisma')

const TASK_TYPES = ['FILTER_CLEANING', 'TOILET_CLEANING', 'BARTENDING', 'TRASH_DISPOSAL']

const isServiceCrew = (employee) => {
  const pos = (employee.position || '').toLowerCase()
  return employee.role === 'STAFF' && (
    pos.includes('service') || pos.includes('waiter') ||
    pos.includes('waitress') || pos.includes('cashier') || pos.includes('counter')
  )
}

function getWeekRange(weekStartStr) {
  const start = weekStartStr ? new Date(weekStartStr) : new Date()
  start.setHours(0, 0, 0, 0)
  const day = start.getDay()
  const diff = start.getDate() - day + (day === 0 ? -6 : 1)
  start.setDate(diff)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return { start, end }
}

// GET /api/tasks?weekStart=&date=&branchId=&employeeId=&taskType=
const getTasks = async (req, res) => {
  try {
    const { date, weekStart, branchId, employeeId, taskType } = req.query

    let dateFilter
    if (date) {
      const d = new Date(date)
      d.setHours(0, 0, 0, 0)
      const next = new Date(d)
      next.setDate(next.getDate() + 1)
      dateFilter = { gte: d, lt: next }
    } else {
      const { start, end } = getWeekRange(weekStart)
      dateFilter = { gte: start, lt: end }
    }

    const tasks = await prisma.task.findMany({
      where: {
        date: dateFilter,
        ...(branchId && { branchId: parseInt(branchId) }),
        ...(employeeId && { employeeId: parseInt(employeeId) }),
        ...(taskType && { taskType })
      },
      include: {
        employee: { select: { id: true, name: true, employeeId: true, position: true } },
        branch: { select: { id: true, name: true } }
      },
      orderBy: [{ date: 'asc' }, { taskType: 'asc' }]
    })

    res.json({ total: tasks.length, tasks })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /api/tasks/my?weekStart=
const getMyTasks = async (req, res) => {
  try {
    const employeeId = req.user.id
    const { weekStart } = req.query
    const { start, end } = getWeekRange(weekStart)

    const tasks = await prisma.task.findMany({
      where: { employeeId, date: { gte: start, lt: end } },
      orderBy: { date: 'asc' }
    })

    res.json({ total: tasks.length, tasks })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// POST /api/tasks
const createTask = async (req, res) => {
  try {
    const { employeeId, taskType, date, branchId, notes } = req.body
    const assignedBy = req.user.id

    if (!employeeId || !taskType || !date) {
      return res.status(400).json({ error: 'employeeId, taskType and date are required' })
    }
    if (!TASK_TYPES.includes(taskType)) {
      return res.status(400).json({ error: `taskType must be one of: ${TASK_TYPES.join(', ')}` })
    }

    const employee = await prisma.employee.findUnique({ where: { id: parseInt(employeeId) } })
    if (!employee) return res.status(404).json({ error: 'Employee not found' })
    if (!isServiceCrew(employee)) {
      return res.status(400).json({ error: 'Only Service Crew staff can be assigned these tasks' })
    }

    const task = await prisma.task.create({
      data: {
        employeeId: parseInt(employeeId),
        taskType,
        date: new Date(date),
        branchId: branchId ? parseInt(branchId) : employee.branchId,
        notes: notes || null,
        assignedBy
      },
      include: {
        employee: { select: { id: true, name: true, employeeId: true } },
        branch: { select: { id: true, name: true } }
      }
    })

    res.status(201).json({ message: 'Task assigned successfully', task })
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'This staff member is already assigned to this task on this date' })
    }
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// PUT /api/tasks/:id
const updateTask = async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { employeeId, status, notes } = req.body

    const data = {}
    if (employeeId !== undefined) {
      const employee = await prisma.employee.findUnique({ where: { id: parseInt(employeeId) } })
      if (!employee) return res.status(404).json({ error: 'Employee not found' })
      if (!isServiceCrew(employee)) {
        return res.status(400).json({ error: 'Only Service Crew staff can be assigned these tasks' })
      }
      data.employeeId = parseInt(employeeId)
    }
    if (status !== undefined) data.status = status
    if (notes !== undefined) data.notes = notes

    const task = await prisma.task.update({
      where: { id },
      data,
      include: {
        employee: { select: { id: true, name: true, employeeId: true } },
        branch: { select: { id: true, name: true } }
      }
    })

    res.json({ message: 'Task updated', task })
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'This staff member is already assigned to this task on this date' })
    }
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// DELETE /api/tasks/:id
const deleteTask = async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    await prisma.task.delete({ where: { id } })
    res.json({ message: 'Task assignment removed' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
// PUT /api/tasks/my/:id/status — Employee marks their own task done/pending
const updateMyTaskStatus = async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const employeeId = req.user.id
    const { status } = req.body

    if (!['PENDING', 'DONE'].includes(status)) {
      return res.status(400).json({ error: 'status must be PENDING or DONE' })
    }

    const task = await prisma.task.findUnique({ where: { id } })
    if (!task) return res.status(404).json({ error: 'Task not found' })
    if (task.employeeId !== employeeId) {
      return res.status(403).json({ error: 'You can only update your own tasks' })
    }

    const updated = await prisma.task.update({ where: { id }, data: { status } })
    res.json({ message: 'Task status updated', task: updated })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = { getTasks, getMyTasks, createTask, updateTask, deleteTask, updateMyTaskStatus }