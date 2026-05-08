const prisma = require('../utils/prisma')

// GET /api/branches
const getAllBranches = async (req, res) => {
  try {
    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { employees: true, timetables: true } }
      },
      orderBy: { name: 'asc' }
    })
    res.json(branches)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /api/branches/:id
const getBranchById = async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const branch = await prisma.branch.findUnique({
      where: { id },
      include: {
        employees: {
          where: { isActive: true },
          select: {
            id: true, employeeId: true, name: true,
            position: true, role: true,
            department: { select: { name: true } }
          }
        },
        timetables: {
          where: { isActive: true },
          select: { id: true, name: true, effectiveFrom: true, effectiveTo: true }
        }
      }
    })

    if (!branch) return res.status(404).json({ error: 'Branch not found' })
    res.json(branch)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// POST /api/branches — Admin only
const createBranch = async (req, res) => {
  try {
    const { name, address } = req.body
    if (!name) return res.status(400).json({ error: 'Branch name is required' })

    const existing = await prisma.branch.findUnique({ where: { name } })
    if (existing) return res.status(409).json({ error: 'Branch name already exists' })

    const branch = await prisma.branch.create({ data: { name, address } })
    res.status(201).json({ message: 'Branch created successfully', branch })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// PUT /api/branches/:id — Admin only
const updateBranch = async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { name, address, isActive } = req.body

    const branch = await prisma.branch.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(address && { address }),
        ...(isActive !== undefined && { isActive })
      }
    })

    res.json({ message: 'Branch updated', branch })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// PUT /api/branches/:id/assign — assign employee to branch
const assignEmployee = async (req, res) => {
  try {
    const branchId = parseInt(req.params.id)
    const { employeeId } = req.body

    if (!employeeId) return res.status(400).json({ error: 'employeeId is required' })

    const employee = await prisma.employee.update({
      where: { id: parseInt(employeeId) },
      data: { branchId },
      select: { id: true, name: true, employeeId: true, branchId: true }
    })

    res.json({ message: 'Employee assigned to branch', employee })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = { getAllBranches, getBranchById, createBranch, updateBranch, assignEmployee }