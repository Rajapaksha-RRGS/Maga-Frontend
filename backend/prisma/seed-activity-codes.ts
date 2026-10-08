import fs from 'fs';
import path from 'path';
import prisma from '../src/config/prisma';

async function main() {
  console.log('Seeding Corporate Activity Codes...');

  // Ensure Project PRJ531 exists
  await prisma.project.upsert({
    where: { projectCode: 'PRJ531' },
    update: {
      description: '531M - iRoad / Central Highway Section',
      projectName: '531M - iRoad / Central Highway Section',
      searchKey: '531M - IROAD',
      status: 'active',
    },
    create: {
      projectCode: 'PRJ531',
      subdomain: '531',
      description: '531M - iRoad / Central Highway Section',
      projectName: '531M - iRoad / Central Highway Section',
      searchKey: '531M - IROAD',
      status: 'active',
      currency: 'LKR',
    },
  });

  // Ensure Maga - CWS project exists
  await prisma.project.upsert({
    where: { projectCode: 'PRJ001' },
    update: {
      description: 'Maga - Head Office & CWS',
      projectName: 'Mäga Engineering (Head Office)',
      searchKey: 'MAGA - HO',
      status: 'active',
    },
    create: {
      projectCode: 'PRJ001',
      subdomain: 'maga',
      description: 'Maga - Head Office & CWS',
      projectName: 'Mäga Engineering (Head Office)',
      searchKey: 'MAGA - HO',
      status: 'active',
      currency: 'LKR',
    },
  });

  const testDataPath = path.resolve(__dirname, '../../testdata.md');
  if (!fs.existsSync(testDataPath)) {
    console.error('testdata.md not found at', testDataPath);
    return;
  }

  const content = fs.readFileSync(testDataPath, 'utf8');
  const lines = content.split(/\r?\n/);

  let inActivitySection = false;
  let count = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## Activity code') || trimmed.startsWith('## Activity Code')) {
      inActivitySection = true;
      continue;
    }
    if (trimmed.startsWith('## ') && inActivitySection) {
      break;
    }
    if (!inActivitySection || !trimmed || trimmed.startsWith('#') || trimmed.startsWith('---')) {
      continue;
    }

    const parts = trimmed.split('|').map((p) => p.trim());
    if (parts.length >= 2) {
      const code = parts[0];
      const description = parts[1];
      const unit = parts[2] || null;

      if (code && description && !code.toLowerCase().includes('code')) {
        await prisma.corporateActivityCode.upsert({
          where: { code },
          update: { description, unit },
          create: { code, description, unit },
        });
        count++;
      }
    }
  }

  console.log(`✅ Finished seeding ${count} Corporate Activity Codes.`);
}

main()
  .catch((e) => {
    console.error('❌ Error in seed-activity-codes:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
