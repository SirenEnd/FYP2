const prisma = require('../utils/prisma')

// ── CONSTANTS ──────────────────────────────────────────────────────
const HOURLY_RATE        = 13.00
const BILLABLE_HRS_DAY   = 6
const OT_MULTIPLIER      = 1.5
const SUPERVISOR_FIXED   = 2500.00
const EPF_RATE           = 0.11
const SOCSO_RATE         = 0.005
const SOCSO_CAP          = 4000

const fmt2 = (n) => parseFloat(Number(n).toFixed(2))

// ── HELPERS ────────────────────────────────────────────────────────

/**
 * Return first and last day of a given month/year (UTC-safe).
 */
function monthBounds(month, year) {
  const cycleStart = new Date(Date.UTC(year, month - 1, 1))
  const cycleEnd   = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
  return { cycleStart, cycleEnd }
}

/**
 * Count working days an employee actually attended (clocked out) in the period.
 */
async function countAttendedDays(employeeId, cycleStart, cycleEnd) {
  const records = await prisma.attendance.findMany({
    where: {
      employeeId,
      clockOut: { not: null },
      date: { gte: cycleStart, lte: cycleEnd },
    },
    select: { date: true },
  })

  // Deduplicate by calendar date (an employee could clock in twice in one day)
  const uniqueDates = new Set(
    records.map((r) => new Date(r.date).toISOString().slice(0, 10))
  )
  return uniqueDates.size
}

/**
 * Calculate payroll figures for one employee.
 */
async function calculatePayroll(employeeId, role, cycleStart, cycleEnd, advanceAmount = 0) {
  const attendances = await prisma.attendance.findMany({
    where: {
      employeeId,
      clockOut: { not: null },
      date: { gte: cycleStart, lte: cycleEnd },
    },
  })

  const attendedDays    = await countAttendedDays(employeeId, cycleStart, cycleEnd)
  const totalClocked    = attendances.reduce((s, a) => s + (a.totalHours || 0), 0)
  const expectedHours   = attendedDays * BILLABLE_HRS_DAY
  const overtimeHours   = fmt2(Math.max(0, totalClocked - expectedHours))
  const overtimePay     = fmt2(overtimeHours * HOURLY_RATE * OT_MULTIPLIER)

  let basePay, grossSalary
  if (role === 'SUPERVISOR') {
    basePay      = SUPERVISOR_FIXED
    grossSalary  = fmt2(basePay + overtimePay)
  } else {
    basePay      = fmt2(attendedDays * BILLABLE_HRS_DAY * HOURLY_RATE)
    grossSalary  = fmt2(basePay + overtimePay)
  }

  const socsoBase      = Math.min(grossSalary, SOCSO_CAP)
  const epfDeduction   = fmt2(grossSalary * EPF_RATE)
  const socsoDeduction = fmt2(socsoBase * SOCSO_RATE)
  const netSalary      = fmt2(grossSalary - epfDeduction - socsoDeduction - advanceAmount)

  return {
    basePay,
    overtimeHours,
    overtimePay,
    grossSalary,
    epfDeduction,
    socsoDeduction,
    netSalary,
    advanceDeduction: fmt2(advanceAmount),
    attendedDays,
    totalHoursWorked: fmt2(totalClocked),
  }
}

// ── GENERATE PAYROLL  POST /api/payroll/generate ──────────────────
const generatePayroll = async (req, res) => {
  try {
    const { month, year } = req.body

    // Validate
    const m = parseInt(month)
    const y = parseInt(year)
    if (!m || !y || m < 1 || m > 12 || y < 2020 || y > 2100) {
      return res.status(400).json({ error: 'Valid month (1-12) and year are required' })
    }

    const { cycleStart, cycleEnd } = monthBounds(m, y)

    // Exclude ADMINs
    const employees = await prisma.employee.findMany({
      where: { isActive: true, role: { not: 'ADMIN' } },
    })

    const results = []
    const errors  = []

    for (const emp of employees) {
      // Prevent duplicate generation for same cycle
      const existing = await prisma.payroll.findFirst({
        where: { employeeId: emp.id, cycleStart, cycleEnd },
      })
      if (existing) {
        errors.push({ employee: emp.name, error: 'Payroll already generated for this cycle' })
        continue
      }

      // Approved, not-yet-deducted advances in this cycle
      const advances = await prisma.salaryAdvance.findMany({
        where: {
          employeeId:       emp.id,
          status:           'APPROVED',
          deductedPayrollId: null,
          requestedAt:      { gte: cycleStart, lte: cycleEnd },
        },
      })
      const advanceTotal = advances.reduce((s, a) => s + a.amount, 0)

      let calc
      try {
        calc = await calculatePayroll(emp.id, emp.role, cycleStart, cycleEnd, advanceTotal)
      } catch (calcErr) {
        errors.push({ employee: emp.name, error: calcErr.message })
        continue
      }

      const payroll = await prisma.payroll.create({
        data: {
          employeeId:      emp.id,
          cycleStart,
          cycleEnd,
          basicSalary:     calc.basePay,
          overtimeHours:   calc.overtimeHours,
          overtimePay:     calc.overtimePay,
          epfDeduction:    calc.epfDeduction,
          socsoDeduction:  calc.socsoDeduction,
          grossSalary:     calc.grossSalary,
          netSalary:       calc.netSalary,
          advanceDeduction: calc.advanceDeduction,
          status:          'PENDING',
        },
      })

      // Link advances to this payroll
      if (advances.length > 0) {
        await prisma.salaryAdvance.updateMany({
          where: { id: { in: advances.map((a) => a.id) } },
          data:  { deductedPayrollId: payroll.id },
        })
      }

      results.push({
        id:              payroll.id,
        employee:        emp.name,
        employeeId:      emp.employeeId,
        role:            emp.role,
        attendedDays:    calc.attendedDays,
        totalHours:      calc.totalHoursWorked,
        basePay:         calc.basePay,
        overtimePay:     calc.overtimePay,
        advanceDeduction: calc.advanceDeduction,
        netSalary:       calc.netSalary,
        status:          'PROCESSED',
      })
    }

    res.status(201).json({
      message:   `Payroll generated for ${new Date(cycleStart).toLocaleString('default', { month: 'long' })} ${y}`,
      month: m,
      year:  y,
      processed: results.length,
      skipped:   errors.length,
      results,
      errors,
    })
  } catch (err) {
    console.error('generatePayroll error:', err)
    res.status(500).json({ error: 'Internal server error: ' + err.message })
  }
}

// ── GET ALL PAYROLL  GET /api/payroll?month=&year= ────────────────
const getAllPayroll = async (req, res) => {
  try {
    const m = parseInt(req.query.month) || new Date().getMonth() + 1
    const y = parseInt(req.query.year)  || new Date().getFullYear()
    const { cycleStart, cycleEnd } = monthBounds(m, y)

    const payrolls = await prisma.payroll.findMany({
      where: { cycleStart, cycleEnd },
      include: {
        employee: {
          select: {
            id: true, employeeId: true, name: true,
            position: true, role: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { employee: { name: 'asc' } },
    })

    // Attach month/year for frontend convenience
    const enriched = payrolls.map((p) => ({
      ...p,
      month: m,
      year:  y,
    }))

    res.json({ month: m, year: y, total: enriched.length, payrolls: enriched })
  } catch (err) {
    console.error('getAllPayroll error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ── GET MY PAYROLL  GET /api/payroll/my ───────────────────────────
const getMyPayroll = async (req, res) => {
  try {
    const employeeId = req.user.id

    const payrolls = await prisma.payroll.findMany({
      where: { employeeId },
      orderBy: { cycleStart: 'desc' },
    })

    // Derive month/year from cycleStart for frontend compatibility
    const enriched = payrolls.map((p) => {
      const d = new Date(p.cycleStart)
      return { ...p, month: d.getUTCMonth() + 1, year: d.getUTCFullYear() }
    })

    res.json({ total: enriched.length, payrolls: enriched })
  } catch (err) {
    console.error('getMyPayroll error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ── GET ONE PAYROLL  GET /api/payroll/:id ─────────────────────────
const getPayrollById = async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid payroll ID' })

    const payroll = await prisma.payroll.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true, employeeId: true, name: true,
            position: true, role: true,
            department: { select: { name: true } },
          },
        },
      },
    })

    if (!payroll) return res.status(404).json({ error: 'Payroll not found' })

    // Staff can only view their own
    if (req.user.role === 'STAFF' && payroll.employeeId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const d = new Date(payroll.cycleStart)
    res.json({ ...payroll, month: d.getUTCMonth() + 1, year: d.getUTCFullYear() })
  } catch (err) {
    console.error('getPayrollById error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ── MARK AS PAID  PUT /api/payroll/:id/pay ────────────────────────
const markAsPaid = async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid payroll ID' })

    const existing = await prisma.payroll.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Payroll not found' })
    if (existing.status === 'PAID') {
      return res.status(409).json({ error: 'Payroll already marked as paid' })
    }

    const payroll = await prisma.payroll.update({
      where: { id },
      data:  { status: 'PAID', paidAt: new Date() },
    })
    res.json({ message: 'Payroll marked as paid', payroll })
  } catch (err) {
    console.error('markAsPaid error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ── DELETE PAYROLL  DELETE /api/payroll/:id ───────────────────────
const deletePayroll = async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid payroll ID' })

    const existing = await prisma.payroll.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Payroll not found' })
    if (existing.status === 'PAID') {
      return res.status(409).json({ error: 'Cannot delete a paid payroll' })
    }

    // Unlink any advances before deleting
    await prisma.salaryAdvance.updateMany({
      where: { deductedPayrollId: id },
      data:  { deductedPayrollId: null },
    })

    await prisma.payroll.delete({ where: { id } })
    res.json({ message: 'Payroll deleted successfully' })
  } catch (err) {
    console.error('deletePayroll error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ── REQUEST ADVANCE  POST /api/payroll/advance ────────────────────
const requestAdvance = async (req, res) => {
  try {
    const employeeId = req.user.id
    const { amount, reason } = req.body

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'A positive amount is required' })
    }

    // Cap: 50% of monthly gross estimate (attendedDays unknown at request time,
    //       so we cap against the employee's stored salary as a proxy).
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
    const cap = fmt2(employee.salary * 0.5)
    if (Number(amount) > cap) {
      return res.status(400).json({
        error: `Advance cannot exceed 50% of your salary (max RM ${cap})`,
      })
    }

    // Prevent duplicate pending advance
    const pending = await prisma.salaryAdvance.findFirst({
      where: { employeeId, status: 'PENDING' },
    })
    if (pending) {
      return res.status(409).json({ error: 'You already have a pending advance request' })
    }

    const advance = await prisma.salaryAdvance.create({
      data: { employeeId, amount: Number(amount), reason },
    })
    res.status(201).json({ message: 'Advance request submitted', advance })
  } catch (err) {
    console.error('requestAdvance error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ── APPROVE ADVANCE  PUT /api/payroll/advance/:id/approve ─────────
const approveAdvance = async (req, res) => {
  try {
    const id         = parseInt(req.params.id)
    const reviewerId = req.user.id

    const advance = await prisma.salaryAdvance.findUnique({ where: { id } })
    if (!advance) return res.status(404).json({ error: 'Advance request not found' })
    if (advance.status !== 'PENDING') {
      return res.status(409).json({ error: 'Advance already reviewed' })
    }

    const updated = await prisma.salaryAdvance.update({
      where: { id },
      data:  { status: 'APPROVED', reviewedBy: reviewerId, reviewedAt: new Date() },
    })
    res.json({ message: 'Advance approved', advance: updated })
  } catch (err) {
    console.error('approveAdvance error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ── REJECT ADVANCE  PUT /api/payroll/advance/:id/reject ──────────
const rejectAdvance = async (req, res) => {
  try {
    const id         = parseInt(req.params.id)
    const reviewerId = req.user.id

    const advance = await prisma.salaryAdvance.findUnique({ where: { id } })
    if (!advance) return res.status(404).json({ error: 'Advance request not found' })
    if (advance.status !== 'PENDING') {
      return res.status(409).json({ error: 'Advance already reviewed' })
    }

    const updated = await prisma.salaryAdvance.update({
      where: { id },
      data:  { status: 'REJECTED', reviewedBy: reviewerId, reviewedAt: new Date() },
    })
    res.json({ message: 'Advance rejected', advance: updated })
  } catch (err) {
    console.error('rejectAdvance error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ── GET ALL ADVANCES  GET /api/payroll/advances ───────────────────
const getAllAdvances = async (req, res) => {
  try {
    const { status } = req.query

    const advances = await prisma.salaryAdvance.findMany({
      where: { ...(status && { status }) },
      include: {
        employee: {
          select: {
            id: true, employeeId: true, name: true,
            position: true, role: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
    })
    res.json({ total: advances.length, advances })
  } catch (err) {
    console.error('getAllAdvances error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ── GET MY ADVANCES  GET /api/payroll/advances/my ─────────────────
const getMyAdvances = async (req, res) => {
  try {
    const employeeId = req.user.id

    const advances = await prisma.salaryAdvance.findMany({
      where: { employeeId },
      orderBy: { requestedAt: 'desc' },
    })
    res.json({ total: advances.length, advances })
  } catch (err) {
    console.error('getMyAdvances error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ── EXPORTS ────────────────────────────────────────────────────────
module.exports = {
  generatePayroll,
  getAllPayroll,
  getMyPayroll,
  getPayrollById,
  markAsPaid,
  deletePayroll,
  requestAdvance,
  approveAdvance,
  rejectAdvance,
  getAllAdvances,
  getMyAdvances,
}