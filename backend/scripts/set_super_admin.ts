import prisma from '../src/config/prisma';
import bcrypt from 'bcrypt';

async function setupSuperAdmin() {
  console.log('👑 Setting up Super Admin for Head Office (maga tenant)...');

  // 1. Get or create maga tenant
  let magaTenant = await prisma.tenant.findUnique({
    where: { subdomain: 'maga' },
  });

  if (!magaTenant) {
    magaTenant = await prisma.tenant.create({
      data: {
        companyName: 'Mäga Engineering (Head Office)',
        subdomain: 'maga',
        addressLine1: '200, Nawala Road',
        addressLine2: 'Narahenpita, Colombo 05',
        phone: '+94 11 2808835',
        email: 'info@maga.lk',
        status: 'active',
      },
    });
    console.log('✅ Created maga tenant:', magaTenant.id);
  } else {
    console.log('ℹ️ Found maga tenant:', magaTenant.id);
  }

  const defaultPasswordHash = await bcrypt.hash('admin123', 10);

  // 2. Upsert super_admin user under maga tenant
  // Check if admin user already exists for maga
  const existingUser = await prisma.user.findFirst({
    where: {
      tenantId: magaTenant.id,
      username: 'admin',
    },
  });

  if (existingUser) {
    const updated = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        role: 'super_admin',
        fullName: 'Head Office Super Admin',
        status: 'active',
      },
    });
    console.log(`✅ Updated existing user "${updated.username}" under "maga" to role: ${updated.role}`);
  } else {
    const created = await prisma.user.create({
      data: {
        tenantId: magaTenant.id,
        username: 'admin',
        fullName: 'Head Office Super Admin',
        role: 'super_admin',
        passwordHash: defaultPasswordHash,
        status: 'active',
        mustChangePassword: false,
      },
    });
    console.log(`✅ Created Super Admin user "${created.username}" under "maga" with role: ${created.role}`);
  }

  // Also check all existing users across all tenants
  const allUsers = await prisma.user.findMany({
    select: {
      username: true,
      fullName: true,
      role: true,
      tenant: {
        select: { subdomain: true, companyName: true },
      },
    },
  });

  console.log('\n📋 Current Users in System:');
  console.table(
    allUsers.map((u) => ({
      Username: u.username,
      Name: u.fullName,
      Role: u.role,
      Project: `${u.tenant.companyName} (${u.tenant.subdomain})`,
    }))
  );
}

setupSuperAdmin()
  .catch((e) => {
    console.error('❌ Error setting up super admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
