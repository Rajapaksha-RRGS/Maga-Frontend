import prisma from '../src/config/prisma';
import bcrypt from 'bcrypt';

async function setupSuperAdmin() {
  console.log('👑 Setting up Super Admin for Head Office (maga project)...');

  // 1. Get or create maga project
  let magaProject = await prisma.mF_P_Project.findFirst({
    where: {
      OR: [
        { subdomain: 'maga' },
        { projectCode: 'PRJ001' },
      ],
    },
  });

  if (!magaProject) {
    magaProject = await prisma.mF_P_Project.create({
      data: {
        projectCode: 'PRJ001',
        projectName: 'Mäga Engineering (Head Office)',
        subdomain: 'maga',
        addressLine1: '200, Nawala Road',
        addressLine2: 'Narahenpita, Colombo 05',
        phone: '+94 11 2808835',
        email: 'info@maga.lk',
        status: 'active',
      },
    });
    console.log('✅ Created maga project:', magaProject.id);
  } else {
    console.log('ℹ️ Found maga project:', magaProject.id);
  }

  const defaultPasswordHash = await bcrypt.hash('admin123', 10);

  // 2. Global Level 1 SuperAdmin
  const superAdmin = await prisma.mF_G_SuperAdmin.upsert({
    where: { username: 'superadmin' },
    update: {
      fullName: 'Head Office Central Super Admin',
      passwordHash: defaultPasswordHash,
      status: 'active',
    },
    create: {
      username: 'superadmin',
      email: 'admin@maga.lk',
      fullName: 'Head Office Central Super Admin',
      passwordHash: defaultPasswordHash,
      status: 'active',
    },
  });
  console.log(`✅ Global SuperAdmin record verified: ${superAdmin.username} (${superAdmin.fullName})`);

  // 3. Upsert admin user under maga project
  const existingUser = await prisma.mF_P_User.findFirst({
    where: {
      projectId: magaProject.id,
      username: 'admin',
    },
  });

  if (existingUser) {
    const updated = await prisma.mF_P_User.update({
      where: { id: existingUser.id },
      data: {
        role: 'admin',
        fullName: 'Head Office Admin',
        status: 'active',
      },
    });
    console.log(`✅ Updated existing user "${updated.username}" under "maga" to role: ${updated.role}`);
  } else {
    const created = await prisma.mF_P_User.create({
      data: {
        projectId: magaProject.id,
        username: 'admin',
        fullName: 'Head Office Admin',
        role: 'admin',
        passwordHash: defaultPasswordHash,
        status: 'active',
        mustChangePassword: false,
      },
    });
    console.log(`✅ Created user "${created.username}" under "maga" with role: ${created.role}`);
  }

  console.log('\n--- CREDENTIALS ---');
  console.log('Global SuperAdmin:  username = "superadmin", password = "admin123"');
  console.log('Project Admin:      subdomain = "maga", username = "admin", password = "admin123"');
  console.log('-------------------\n');
}

setupSuperAdmin()
  .catch((e) => {
    console.error('❌ Error setting up super admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
