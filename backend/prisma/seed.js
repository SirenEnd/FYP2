const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  // ─────────────────────────────
  // DEPARTMENTS
  // ─────────────────────────────
  const kitchen = await prisma.department.upsert({
    where: { name: 'Kitchen' },
    update: {},
    create: { name: 'Kitchen' }
  })

  const management = await prisma.department.upsert({
    where: { name: 'Management' },
    update: {},
    create: { name: 'Management' }
  })

  const service = await prisma.department.upsert({
    where: { name: 'Service' },
    update: {},
    create: { name: 'Service' }
  })

  // ─────────────────────────────
  // BRANCHES
  // ─────────────────────────────
  const branches = await Promise.all([
    prisma.branch.upsert({
      where: { name: 'DevBranch' },
      update: {},
      create: {
        name: 'DevBranch',
        address: 'Dev Branch HQ',
        latitude: 2.94912,
        longitude: 101.669274
      }
    }),
    prisma.branch.upsert({
      where: { name: 'AirPutih' },
      update: {},
      create: {
        name: 'AirPutih',
        address: 'Air Putih, Kuantan',
        latitude: 3.8327916381049496,
        longitude: 103.34161541779093
      }
    }),
    prisma.branch.upsert({
      where: { name: 'InderaMahkota' },
      update: {},
      create: {
        name: 'InderaMahkota',
        address: 'Indera Mahkota, Kuantan',
        latitude: 3.835268812791736,
        longitude: 103.30137698514375
      }
    })
  ])

  const [dev, airPutih, indera] = branches

  const password = await bcrypt.hash('password123', 10)

  // ─────────────────────────────
  // EXISTING ACCOUNTS
  // ─────────────────────────────
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

  await prisma.employee.upsert({
    where: { email: 'supervisor@restrohr.com' },
    update: {},
    create: {
      employeeId: 'RST-007',
      name: 'Nurul Hidayah',
      email: 'supervisor@restrohr.com',
      password,
      role: 'SUPERVISOR',
      position: 'Kitchen Supervisor',
      salary: 3200,
      departmentId: kitchen.id,
      branchId: dev.id
    }
  })

  await prisma.employee.upsert({
    where: { email: 'staff@restrohr.com' },
    update: {},
    create: {
      employeeId: 'RST-001',
      name: 'Ahmad Rizal',
      email: 'staff@restrohr.com',
      password,
      role: 'STAFF',
      position: 'Kitchen Staff',
      salary: 1800,
      departmentId: kitchen.id,
      branchId: airPutih.id
    }
  })

  // ─────────────────────────────
  // EXTRA SUPERVISOR
  // ─────────────────────────────
  await prisma.employee.upsert({
    where: { email: 'supervisor2@restrohr.com' },
    update: {},
    create: {
      employeeId: 'RST-008',
      name: 'Siti Aisyah',
      email: 'supervisor2@restrohr.com',
      password,
      role: 'SUPERVISOR',
      position: 'Service Supervisor',
      salary: 3300,
      departmentId: service.id,
      branchId: indera.id
    }
  })

  // ─────────────────────────────
  // STAFF GENERATOR
  // ─────────────────────────────
  const kitchenNames = [
    'Mohd Farhan','Aiman Hakim','Syafiq Rahman','Zulhilmi Iskandar','Hakim Zulkifli',
    'Amirul Haziq','Faiz Izzat','Danial Hakim','Ridzuan Ariff','Hafizuddin Shah'
  ]

  const serviceNames = [
    'Nur Aina','Siti Nurhaliza','Farah Syazwani','Intan Balqis','Nadia Sofea',
    'Liyana Hazimah','Aisyah Humaira','Puteri Qistina','Balqis Najwa','Hana Sofea'
  ]

  let counter = 100

  // Kitchen Crew (10)
  for (let i = 0; i < kitchenNames.length; i++) {
    await prisma.employee.create({
      data: {
        employeeId: `RST-${counter++}`,
        name: kitchenNames[i],
        email: `kitchen${i + 1}@restrohr.com`,
        password,
        role: 'STAFF',
        position: 'Kitchen Crew',
        salary: 1800,
        departmentId: kitchen.id,
        branchId: i % 3 === 0 ? dev.id : i % 3 === 1 ? airPutih.id : indera.id
      }
    })
  }

  // Service Crew (10)
  for (let i = 0; i < serviceNames.length; i++) {
    await prisma.employee.create({
      data: {
        employeeId: `RST-${counter++}`,
        name: serviceNames[i],
        email: `service${i + 1}@restrohr.com`,
        password,
        role: 'STAFF',
        position: 'Service Crew',
        salary: 1700,
        departmentId: service.id,
        branchId: i % 3 === 0 ? dev.id : i % 3 === 1 ? airPutih.id : indera.id
      }
    })
  }

  console.log('Seed complete!')
  console.log('Branches + Employees created successfully')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())