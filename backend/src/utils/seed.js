require('dotenv').config()
const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
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

  const password = await bcrypt.hash('password123', 10)

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
      departmentId: kitchen.id
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
      departmentId: kitchen.id
    }
  })

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

  console.log('Seed complete! Test accounts created:')
  console.log('   Staff      -> staff@restrohr.com / password123')
  console.log('   Supervisor -> supervisor@restrohr.com / password123')
  console.log('   Admin      -> admin@restrohr.com / password123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())