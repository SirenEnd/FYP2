const prisma = require('../utils/prisma')

const HOURLY_RATE = 13.00
const BILLABLE_HOURS_PER_DAY = 6
const WORKING_DAYS_PER_CYCLE = 24
const CYCLE_DAYS = 28
const OT_MULTIPLIER = 1.5
const SUPERVISOR_FIXED = 2500.00
const ADVANCE_MAX_PERCENT = 0.50
const EPF_RATE = 0.11
const SOCSO_RATE = 0.005
const SOCSO_CAP = 4000

const fmt2 = (n) => parseFloat(n.toFixed(2))

const calculatePayroll = (attendances, role, basicSalary, advanceAmount = 0) => {
  const completedSessions = attendances.filter(a => a.clockOut !== null)
  const attendedDays = new Set(
    completedSessions.map(a => new Date(a.date).toDateString())
  ).size

  const totalClocked = completedSessions.reduce((sum, a) => sum + (a.totalHours || 0), 0)
  const expectedHours = attendedDays * BILLABLE_HOURS_PER_DAY
  const overtimeHours = fmt2(Math.max(0, totalClocked - expectedHours))

  let basePay, overtimePay, grossSalary

  if (role === 'SUPERVISOR') {
    basePay = SUPERVISOR_FIXED
    overtimePay = fmt2(overtimeHours * HOURLY_RATE * OT_MULTIPLIER)
    grossSalary = fmt2(basePay + overtimePay)
  } else {
    basePay = fmt2(WORKING_DAYS_PER_CYCLE * BILLABLE_HOURS_PER_DAY * HOURLY_RATE)
    overtimePay = fmt2(overtimeHours * HOURLY_RATE * OT_MULTIPLIER)
    grossSalary = fmt2(basePay + overtimePay)
  }

  const socsoBase = Math.min(grossSalary, SOCSO_CAP)
  const epfDeduction = fmt2(grossSalary * EPF_RATE)
  const socsoDeduction = fmt2(socsoBase * SOCSO_RATE)
  const netSalary = fmt2(grossSalary - epfDeduction - socsoDeduction - advanceAmount)

  return {
    basePay, overtimeHours, overtimePay, grossSalary,
    epfDeduction, socsoDeduction, netSalary,
    advanceDeduction: advanceAmount, attendedDays,
    totalHoursWorked: fmt2(totalClocked)
  }
}

// POST /api/payroll/generate
const generatePayroll = async (req, res) => {
  try {
    const { cycleStart, cycleEnd } = req.body
    if (!cycleStart || !cycleEnd)
      return res.status(400).json({ error: 'cycleStart and cycleEnd are required' })

    const start = new Date(cycleStart)
    const end = new Date(cycleEnd)
    end.setHours(23, 59, 59, 999)

    // Exclude ADMINs
    const employees = await prisma.employee.findMany({
      where: { isActive: true, role: { not: 'ADMIN' } }
    })

    const results = [], errors = []

    for (const emp of employees) {
      const existing = await prisma.payroll.findFirst({
        where: { employeeId: emp.id, cycleStart: start }
      })
      if (existing) {
        errors.push({ employee: emp.name, error: 'Payroll already generated for this cycle' })
        continue
      }

      const attendances = await prisma.attendance.findMany({
        where: { employeeId: emp.id, date: { gte: start, lte: end }, clockOut: { not: null } }
      })

      // Sum approved advances for this cycle
      const advances = await prisma.salaryAdvance.findMany({
        where: { employeeId: emp.id, status: 'APPROVED',
          requestedAt: { gte: start, lte: end } }
      })
      const advanceTotal = advances.reduce((s, a) => s + a.amount, 0)

      const calc = calculatePayroll(attendances, emp.role, emp.salary, advanceTotal)

      const payroll = await prisma.payroll.create({
          data: {
            employeeId: emp.id,
            cycleStart: start,
            cycleEnd: end,
            basicSalary: calc.basePay,
            overtimeHours: calc.overtimeHours,
            overtimePay: calc.overtimePay,
            epfDeduction: calc.epfDeduction,
            socsoDeduction: calc.socsoDeduction,
            grossSalary: calc.grossSalary,
            netSalary: calc.netSalary,
            advanceDeduction: calc.advanceDeduction,
            status: 'PENDING'
          }
        })

      // Link advance records to this payroll
      if (advances.length > 0) {
        await prisma.salaryAdvance.updateMany({
          where: { id: { in: advances.map(a => a.id) } },
          data: { deductedPayrollId: payroll.id }
        })
      }

      results.push({
        id: payroll.id, employee: emp.name, employeeId: emp.employeeId,
        role: emp.role, attendedDays: calc.attendedDays,
        totalHours: calc.totalHoursWorked, basePay: calc.basePay,
        overtimePay: calc.overtimePay, advanceDeduction: calc.advanceDeduction,
        netSalary: calc.netSalary, status: 'PROCESSED'
      })
    }

    res.status(201).json({
      message: `Payroll generated for cycle ${cycleStart} → ${cycleEnd}`,
      cycleStart, cycleEnd,
      processed: results.length, skipped: errors.length,
      results, errors
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /api/payroll
const getAllPayroll = async (req, res) => {
  try {
    const { cycleStart } = req.query
    const payrolls = await prisma.payroll.findMany({
      where: { ...(cycleStart && { cycleStart: new Date(cycleStart) }) },
      include: {
        employee: { select: { employeeId: true, name: true, position: true, role: true, department: { select: { name: true } } } }
      },
      orderBy: [{ cycleStart: 'desc' }, { employee: { name: 'asc' } }]
    })
    const totalNet = payrolls.reduce((s, p) => s + p.netSalary, 0)
    res.json({ total: payrolls.length, totalNetSalary: parseFloat(totalNet.toFixed(2)), payrolls })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /api/payroll/my
const getMyPayroll = async (req, res) => {
  try {
    const payrolls = await prisma.payroll.findMany({
      where: { employeeId: req.user.id },
      orderBy: { cycleStart: 'desc' }
    })
    res.json({ total: payrolls.length, payrolls })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /api/payroll/:id
const getPayrollById = async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const payroll = await prisma.payroll.findUnique({
      where: { id },
      include: { employee: { select: { employeeId: true, name: true, position: true, role: true, department: { select: { name: true } } } } }
    })
    if (!payroll) return res.status(404).json({ error: 'Payroll record not found' })
    if (req.user.role === 'STAFF' && payroll.employeeId !== req.user.id)
      return res.status(403).json({ error: 'Access denied' })
    res.json(payroll)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// PUT /api/payroll/:id/pay
const markAsPaid = async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const payroll = await prisma.payroll.findUnique({ where: { id } })
    if (!payroll) return res.status(404).json({ error: 'Payroll not found' })
    if (payroll.status === 'PAID') return res.status(409).json({ error: 'Already paid' })
    const updated = await prisma.payroll.update({ where: { id }, data: { status: 'PAID', paidAt: new Date() } })
    res.json({ message: 'Payroll marked as paid', payroll: updated })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// DELETE /api/payroll/:id
const deletePayroll = async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const payroll = await prisma.payroll.findUnique({ where: { id } })
    if (!payroll) return res.status(404).json({ error: 'Payroll not found' })
    if (payroll.status === 'PAID') return res.status(409).json({ error: 'Cannot delete a paid record' })
    await prisma.payroll.delete({ where: { id } })
    res.json({ message: 'Payroll deleted' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// POST /api/payroll/advance — Staff requests advance
const requestAdvance = async (req, res) => {
  try {
    const employeeId = req.user.id
    const { amount, reason } = req.body
    if (!amount) return res.status(400).json({ error: 'amount is required' })

    const emp = await prisma.employee.findUnique({ where: { id: employeeId } })
    const maxAdvance = emp.role === 'SUPERVISOR'
      ? SUPERVISOR_FIXED * ADVANCE_MAX_PERCENT
      : WORKING_DAYS_PER_CYCLE * BILLABLE_HOURS_PER_DAY * HOURLY_RATE * ADVANCE_MAX_PERCENT

    if (parseFloat(amount) > maxAdvance)
      return res.status(400).json({ error: `Advance cannot exceed RM${maxAdvance.toFixed(2)} (50% of base pay)`, maxAdvance })

    const advance = await prisma.salaryAdvance.create({
      data: { employeeId, amount: parseFloat(amount), reason, status: 'PENDING' }
    })
    res.status(201).json({ message: 'Advance request submitted', advance, maxAdvance })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// PUT /api/payroll/advance/:id/approve
const approveAdvance = async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const advance = await prisma.salaryAdvance.update({
      where: { id },
      data: { status: 'APPROVED', reviewedBy: req.user.id, reviewedAt: new Date() }
    })
    res.json({ message: 'Advance approved', advance })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// PUT /api/payroll/advance/:id/reject
const rejectAdvance = async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const advance = await prisma.salaryAdvance.update({
      where: { id },
      data: { status: 'REJECTED', reviewedBy: req.user.id, reviewedAt: new Date() }
    })
    res.json({ message: 'Advance rejected', advance })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /api/payroll/advances
const getAllAdvances = async (req, res) => {
  try {
    const advances = await prisma.salaryAdvance.findMany({
      include: { employee: { select: { employeeId: true, name: true, role: true, position: true } } },
      orderBy: { requestedAt: 'desc' }
    })
    res.json({ total: advances.length, advances })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /api/payroll/advances/my
const getMyAdvances = async (req, res) => {
  try {
    const advances = await prisma.salaryAdvance.findMany({
      where: { employeeId: req.user.id },
      orderBy: { requestedAt: 'desc' }
    })
    res.json({ total: advances.length, advances })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = {
  generatePayroll, getAllPayroll, getMyPayroll, getPayrollById,
  markAsPaid, deletePayroll, requestAdvance, approveAdvance, rejectAdvance,
  getAllAdvances, getMyAdvances
}