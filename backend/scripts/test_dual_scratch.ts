import prisma from '../src/config/prisma';
import { bulkImportCorporateActivityCodes } from '../src/controllers/corporateController';

async function testMultiRowImport() {
  const req: any = {
    body: {
      records: [
        // Line 1 for Project 531
        {
          code: 'TEST-DUAL-ROW',
          description: 'Testing Dual Row Assignment',
          unit: 'm3',
          currentWorkingProject: '531'
        },
        // Line 2 with SAME code for Project 521
        {
          code: 'TEST-DUAL-ROW',
          description: 'Testing Dual Row Assignment',
          unit: 'm3',
          currentWorkingProject: '521'
        }
      ]
    }
  };

  const res: any = {
    status: (code: number) => ({
      json: (data: any) => console.log(`Response [${code}]:`, data)
    }),
    json: (data: any) => console.log('Response [200]:', data)
  };

  await bulkImportCorporateActivityCodes(req, res);

  // Check how many projects it was assigned to
  const pList = await prisma.mF_P_ActivityCode.findMany({
    where: { code: 'TEST-DUAL-ROW' },
    include: { project: true }
  });

  console.log(`Assigned to ${pList.length} projects:`, pList.map(p => p.project.projectCode || p.project.subdomain));

  // Clean up
  await prisma.mF_P_ActivityCode.deleteMany({ where: { code: 'TEST-DUAL-ROW' } });
  await prisma.mF_G_ActivityCode.deleteMany({ where: { code: 'TEST-DUAL-ROW' } });
  console.log('Cleaned up test data.');
}

testMultiRowImport().catch(console.error).finally(() => prisma.$disconnect());

