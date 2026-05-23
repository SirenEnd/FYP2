const prisma = require('../utils/prisma')

// POST /api/leave — Staff applies for leave
const applyLeave = async (req, res) => {
  try {
    const employeeId = req.user.id
    const { leaveType, startDate, endDate, reason } = req.body

    if (!leaveType || !startDate || !endDate) {
      return res.status(400).json({ error: 'leaveType, startDate and endDate are required' })
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (end < start) {
      return res.status(400).json({ error: 'End date cannot be before start date' })
    }

    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1

    const overlap = await prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [{ startDate: { lte: end }, endDate: { gte: start } }]
      }
    })

    if (overlap) {
      return res.status(409).json({ error: 'You already have a leave request overlapping these dates' })
    }

    const leave = await prisma.leaveRequest.create({
      data: { employeeId, leaveType, startDate: start, endDate: end, totalDays, reason }
    })

    res.status(201).json({ message: 'Leave request submitted successfully', leave })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /api/leave/my — Staff views own leave history
const getMyLeave = async (req, res) => {
  try {
    const employeeId = req.user.id
    const leaves = await prisma.leaveRequest.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' }
    })
    res.json(leaves)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /api/leave — Supervisor/Admin views all
const getAllLeave = async (req, res) => {
  try {
    const { status } = req.query
    const requestingRole = req.user.role

    // Supervisors only see STAFF leave
    // Admins see everyone including SUPERVISOR leave
    const roleFilter = requestingRole === 'SUPERVISOR'
      ? { role: 'STAFF' }
      : {}

    const leaves = await prisma.leaveRequest.findMany({
      where: {
        ...(status && { status }),
        employee: roleFilter
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            name: true,
            position: true,
            role: true,
            department: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json({ total: leaves.length, leaves })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// PUT /api/leave/:id/approve
const approveLeave = async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const reviewerId = req.user.id

    const leave = await prisma.leaveRequest.findUnique({ where: { id } })
    if (!leave) return res.status(404).json({ error: 'Leave request not found' })
    if (leave.status !== 'PENDING') {
      return res.status(409).json({ error: 'Leave request already reviewed' })
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: { status: 'APPROVED', reviewedBy: reviewerId, reviewedAt: new Date() }
    })

    res.json({ message: 'Leave request approved', leave: updated })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// PUT /api/leave/:id/reject
const rejectLeave = async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const reviewerId = req.user.id

    const leave = await prisma.leaveRequest.findUnique({ where: { id } })
    if (!leave) return res.status(404).json({ error: 'Leave request not found' })
    if (leave.status !== 'PENDING') {
      return res.status(409).json({ error: 'Leave request already reviewed' })
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: { status: 'REJECTED', reviewedBy: reviewerId, reviewedAt: new Date() }
    })

    res.json({ message: 'Leave request rejected', leave: updated })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// DELETE /api/leave/:id — Cancel own pending leave
const cancelLeave = async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const employeeId = req.user.id

    const leave = await prisma.leaveRequest.findUnique({ where: { id } })
    if (!leave) return res.status(404).json({ error: 'Leave request not found' })
    if (leave.employeeId !== employeeId) {
      return res.status(403).json({ error: 'You can only cancel your own leave requests' })
    }
    if (leave.status !== 'PENDING') {
      return res.status(409).json({ error: 'Only pending requests can be cancelled' })
    }

    await prisma.leaveRequest.delete({ where: { id } })
    res.json({ message: 'Leave request cancelled' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = { applyLeave, getMyLeave, getAllLeave, approveLeave, rejectLeave, cancelLeave }