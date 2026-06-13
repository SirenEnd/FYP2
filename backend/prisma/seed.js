const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const password = await bcrypt.hash('password123', 10)

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
  // BRANCHES (adjusted ~100m safe radius centers)
  // ─────────────────────────────
  const branches = [
    {
      name: 'DevBranch',
      address: 'Dev Branch HQ',
      latitude: 2.949200,
      longitude: 101.669300
    },
    {
      name: 'AirPutih',
      address: 'Air Putih Branch',
      latitude: 3.832800,
      longitude: 103.341620
    },
    {
      name: 'InderaMahkota',
      address: 'Indera Mahkota Branch',
      latitude: 3.835300,
      longitude: 103.301380
    }
  ]

  const createdBranches = {}

  for (const b of branches) {
    createdBranches[b.name] = await prisma.branch.upsert({
      where: { name: b.name },
      update: {},
      create: {
        name: b.name,
        address: b.address,
        latitude: b.latitude,
        longitude: b.longitude,
        isActive: true
      }
    })
  }

  // ─────────────────────────────
  // USERS
  // ─────────────────────────────

  // Admin
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
      departmentId: management.id
    }
  })

  // Supervisor 1
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
      branchId: createdBranches.DevBranch.id
    }
  })

  // Supervisor 2 (NEW)
  await prisma.employee.upsert({
    where: { email: 'supervisor2@restrohr.com' },
    update: {},
    create: {
      employeeId: 'RST-008',
      name: 'Aiman Rahman',
      email: 'supervisor2@restrohr.com',
      password,
      role: 'SUPERVISOR',
      position: 'Branch Supervisor',
      salary: 3200,
      departmentId: management.id,
      branchId: createdBranches.AirPutih.id
    }
  })

  // ─────────────────────────────
  // STAFF GENERATION
  // ─────────────────────────────

  let staffCount = 1

  // 10 Kitchen Staff
  for (let i = 0; i < 10; i++) {
    await prisma.employee.upsert({
      where: { email: `kitchen${i}@restrohr.com` },
      update: {},
      create: {
        employeeId: `KCH-${String(staffCount).padStart(3, '0')}`,
        name: `Kitchen Staff ${i + 1}`,
        email: `kitchen${i}@restrohr.com`,
        password,
        role: 'STAFF',
        position: 'Kitchen Crew',
        salary: 1800,
        departmentId: kitchen.id,
        branchId: i % 2 === 0 ? createdBranches.DevBranch.id : createdBranches.AirPutih.id
      }
    })
    staffCount++
  }

  // 10 Service Staff
  for (let i = 0; i < 10; i++) {
    await prisma.employee.upsert({
      where: { email: `service${i}@restrohr.com` },
      update: {},
      create: {
        employeeId: `SRV-${String(staffCount).padStart(3, '0')}`,
        name: `Service Staff ${i + 1}`,
        email: `service${i}@restrohr.com`,
        password,
        role: 'STAFF',
        position: 'Service Crew',
        salary: 1800,
        departmentId: service.id,
        branchId: i % 2 === 0 ? createdBranches.AirPutih.id : createdBranches.InderaMahkota.id
      }
    })
    staffCount++
  }

  console.log('Seed complete!')
  console.log('Branches created: DevBranch, AirPutih, InderaMahkota')
  console.log('Users created: 1 Admin, 2 Supervisors, 20 Staff')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())