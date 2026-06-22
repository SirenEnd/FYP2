const prisma = require('../utils/prisma')

const POSITIONS = ['KITCHEN_STAFF', 'SERVICE_CREW']
const STATUSES = ['PENDING', 'REVIEWED', 'CONTACTED', 'REJECTED']
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// POST /api/job-applications — Public, no login required (used by "Join Our Crew")
const submitApplication = async (req, res) => {
  try {
    const { name, email, phone, address, position, typhoidVaccinated, vaccinationYear } = req.body

    if (!name?.trim() || !email?.trim() || !phone?.trim() || !address?.trim() || !position) {
      return res.status(400).json({ error: 'name, email, phone, address and position are required' })
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ error: 'Please provide a valid email address' })
    }

    if (!POSITIONS.includes(position)) {
      return res.status(400).json({ error: `position must be one of: ${POSITIONS.join(', ')}` })
    }

    if (typeof typhoidVaccinated !== 'boolean') {
      return res.status(400).json({ error: 'Please indicate whether you are vaccinated against typhoid' })
    }

    let yearValue = null
    if (typhoidVaccinated) {
      const currentYear = new Date().getFullYear()
      yearValue = parseInt(vaccinationYear)
      if (!vaccinationYear || isNaN(yearValue) || yearValue < 1950 || yearValue > currentYear) {
        return res.status(400).json({
          error: `Please provide a valid vaccination year between 1950 and ${currentYear}`
        })
      }
    }

    const application = await prisma.jobApplication.create({
      data: {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        position,
        typhoidVaccinated,
        vaccinationYear: yearValue
      }
    })

    res.status(201).json({ message: 'Application submitted successfully', application })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /api/job-applications?status=&position= — Admin/Supervisor
const getAllApplications = async (req, res) => {
  try {
    const { status, position } = req.query

    const applications = await prisma.jobApplication.findMany({
      where: {
        ...(status && { status }),
        ...(position && { position })
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json({ total: applications.length, applications })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /api/job-applications/:id — Admin/Supervisor
const getApplicationById = async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid application ID' })

    const application = await prisma.jobApplication.findUnique({ where: { id } })
    if (!application) return res.status(404).json({ error: 'Application not found' })

    res.json(application)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// PUT /api/job-applications/:id/status — Admin/Supervisor
const updateApplicationStatus = async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const reviewerId = req.user.id
    const { status } = req.body

    if (isNaN(id)) return res.status(400).json({ error: 'Invalid application ID' })
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` })
    }

    const existing = await prisma.jobApplication.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Application not found' })

    const application = await prisma.jobApplication.update({
      where: { id },
      data: { status, reviewedBy: reviewerId, reviewedAt: new Date() }
    })

    res.json({ message: 'Application status updated', application })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// DELETE /api/job-applications/:id — Admin only
const deleteApplication = async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid application ID' })

    const existing = await prisma.jobApplication.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Application not found' })

    await prisma.jobApplication.delete({ where: { id } })
    res.json({ message: 'Application deleted successfully' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = {
  submitApplication,
  getAllApplications,
  getApplicationById,
  updateApplicationStatus,
  deleteApplication
}