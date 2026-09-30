import fs from 'fs';
import path from 'path';
import prisma from '../src/config/prisma';

async function main() {
  console.log('Seeding Corporate Activity Codes...');

  // Ensure CorporateProject M00000531 exists
  await prisma.corporateProject.upsert({
    where: { projectCode: 'M00000531' },
    update: {
      description: '531M - iRoad / Central Highway Section',
      projectName: '531M - iRoad / Central Highway Section',
      searchKey: '531M - IROAD',
      status: 'Active',
    },
    create: {
      projectCode: 'M00000531',
      description: '531M - iRoad / Central Highway Section',
      projectName: '531M - iRoad / Central Highway Section',
      searchKey: '531M - IROAD',
      status: 'Active',
      currency: 'LKR',
    },
  });

  // Ensure Maga - CWS project exists
  await prisma.corporateProject.upsert({
    where: { projectCode: 'M00000001' },
    update: {
      description: 'Maga - CWS (Central Workshop)',
      projectName: 'Central Workshop Walgama',
      searchKey: 'MAGA - CWS',
      status: 'Active',
    },
    create: {
      projectCode: 'M00000001',
      description: 'Maga - CWS (Central Workshop)',
      projectName: 'Central Workshop Walgama',
      searchKey: 'MAGA - CWS',
      status: 'Active',
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
    if (trimmed.startsWith('## Activity code')) {
      inActivitySection = true;
      continue;
    }
    if (inActivitySection && trimmed.startsWith('## ')) {
      inActivitySection = false;
      break;
    }
    if (!inActivitySection) continue;
    if (!trimmed || trimmed.toLowerCase().includes('projectcode')) continue;

    // Line format: Projectcode | Activity| Description
    const parts = trimmed.split('|').map((p) => p.trim());
    if (parts.length >= 3) {
      const projectCode = parts[0];
      const code = parts[1];
      const description = parts.slice(2).join(' - ').trim();

      if (code && projectCode) {
        await prisma.corporateActivityCode.upsert({
          where: {
            projectCode_code: {
              projectCode,
              code,
            },
          },
          update: {
            description,
            searchKey: description.slice(0, 16).toUpperCase(),
            currentWorkingProject: projectCode,
          },
          create: {
            projectCode,
            code,
            description,
            searchKey: description.slice(0, 16).toUpperCase(),
            activityType: 'Work Package',
            unit: 'ite',
            timeUnit: 'hrs',
            currentWorkingProject: projectCode,
          },
        });
        count++;
      }
    }
  }

  console.log(`Successfully seeded ${count} corporate activity codes for project M00000531!`);
}

main()
  .catch((e) => {
    console.error('Error seeding activity codes:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
