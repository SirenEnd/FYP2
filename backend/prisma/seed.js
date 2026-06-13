const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// ─── HELPERS ───────────────────────────────
const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)]

// Malaysian-style names
const maleNames = [
  "Ahmad", "Muhammad", "Zulqarnain", "Aiman", "Hakim",
  "Firdaus", "Amir", "Syafiq", "Hafiz", "Imran"
]

const femaleNames = [
  "Nurul", "Siti", "Aisyah", "Hannah", "Farah",
  "Nadia", "Syaza", "Izzati", "Aina", "Balqis"
]

const lastNames = [
  "Hassan", "Ismail", "Rahman", "Abdullah", "Kamal",
  "Razak", "Halim", "Omar", "Yusof", "Ali"
]

// ─── MAIN SEED ─────────────────────────────
async function main() {
  const password = await bcrypt.hash('password123', 10)

  // ─── BRANCHES ───────────────────────────
  const branches = await Promise.all([
    prisma.branch.upsert({
      where: { name: 'DevBranch' },
      update: {},
      create: {
        name: 'DevBranch',
        latitude: 2.949120,
        longitude: 101.669274
      }
    }),
    prisma.branch.upsert({
      where: { name: 'AirPutih' },
      update: {},
      create: {
        name: 'AirPutih',
        latitude: 3.832792,
        longitude: 103.341615
      }
    }),
    prisma.branch.upsert({
      where: { name: 'InderaMahkota' },
      update: {},
      create: {
        name: 'InderaMahkota',
        latitude: 3.835269,
        longitude: 103.301377
      }
    })
  ])

  const [dev, airPutih, indera] = branches

  // ─── DEPARTMENTS ─────────────────────────
  const kitchen = await prisma.department.upsert({
    where: { name: 'Kitchen' },
    update: {},
    create: { name: 'Kitchen' }
  })

  const service = await prisma.department.upsert({
    where: { name: 'Service' },
    update: {},
    create: { name: 'Service' }
  })

  const management = await prisma.department.upsert({
    where: { name: 'Management' },
    update: {},
    create: { name: 'Management' }
  })

  // ─── ADMIN ───────────────────────────────
  await prisma.employee.upsert({
    where: { email: 'admin@restrohr.com' },
    update: {},
    create: {
      employeeId: 'RST-000',
      name: 'Faizal Hassan',
      email: 'admin@restrohr.com',
      password,
      role: 'ADMIN',
      position: 'System Administrator',
      salary: 5000,
      departmentId: management.id,
      branchId: dev.id
    }
  })

  // ─── SUPERVISORS ─────────────────────────
  const supervisors = [
    {
      employeeId: 'RST-007',
      name: 'Nurul Hidayah',
      email: 'supervisor1@restrohr.com',
      position: 'Kitchen Supervisor'
    },
    {
      employeeId: 'RST-008',
      name: 'Muhammad Hakim Razak',
      email: 'supervisor2@restrohr.com',
      position: 'Operations Supervisor'
    }
  ]

  for (let i = 0; i < supervisors.length; i++) {
    await prisma.employee.upsert({
      where: { email: supervisors[i].email },
      update: {},
      create: {
        ...supervisors[i],
        password,
        role: 'SUPERVISOR',
        salary: 3200,
        departmentId: management.id,
        branchId: branches[i % branches.length].id
      }
    })
  }

  // ─── STAFF (20 TOTAL) ─────────────────────
  const staffList = []

  for (let i = 1; i <= 10; i++) {
    staffList.push({
      type: 'Kitchen',
      departmentId: kitchen.id
    })
  }

  for (let i = 1; i <= 10; i++) {
    staffList.push({
      type: 'Service',
      departmentId: service.id
    })
  }

  for (let i = 0; i < staffList.length; i++) {
    const first = randomFrom(maleNames.concat(femaleNames))
    const last = randomFrom(lastNames)

    await prisma.employee.create({
      data: {
        employeeId: `RST-${100 + i}`,
        name: `${first} ${last}`,
        email: `staff${i + 1}@restrohr.com`,
        password,
        role: 'STAFF',
        position: `${staffList[i].type} Crew`,
        salary: 1800,
        departmentId: staffList[i].departmentId,
        branchId: branches[i % branches.length].id
      }
    })
  }

  console.log('Seed complete!')
  console.log('Branches + Supervisors + 20 Staff created')
  console.log('Password for all accounts: password123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())