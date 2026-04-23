const prisma = require('../utils/prisma')

// GET /api/departments
const getAllDepartments = async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        _count: { select: { employees: true } }
      },
      orderBy: { name: 'asc' }
    })
    res.json(departments)
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
}

// POST /api/departments — Admin only
const createDepartment = async (req, res) => {
  try {
    const { name } = req.body
    if (!name) return res.status(400).json({ error: 'Name is required' })

    const department = await prisma.department.create({ data: { name } })
    res.status(201).json({ message: 'Department created', department })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = { getAllDepartments, createDepartment }