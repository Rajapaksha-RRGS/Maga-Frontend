import fs from 'fs';
import path from 'path';
import prisma from '../src/config/prisma';

async function main() {
  console.log('🚀 Starting Clean Corporate Master Data Seeding from testdata.md...');

  const testDataPath = path.resolve(__dirname, '../../testdata.md');
  if (!fs.existsSync(testDataPath)) {
    throw new Error(`testdata.md not found at ${testDataPath}`);
  }

  const content = fs.readFileSync(testDataPath, 'utf8');
  const lines = content.split(/\r?\n/);

  let currentSection = '';

  let bpCount = 0;
  let driverCount = 0;
  let laborCount = 0;
  let eqCount = 0;
  let actCount = 0;
  let projCount = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith('## ')) {
      currentSection = line.replace('## ', '').trim();
      continue;
    }

    if (!line || line.startsWith('#') || line.startsWith('---')) continue;

    const parts = line.split('|').map((p) => p.trim());
    const firstColLower = parts[0]?.toLowerCase() || '';
    if (
      firstColLower.includes('code') ||
      firstColLower.includes('project') ||
      firstColLower.includes('calling') ||
      firstColLower.includes('employee') ||
      firstColLower.includes('erp new')
    ) {
      continue;
    }

    // 1. BUSINESS PARTNERS
    if (currentSection === 'Business Partners' && parts.length >= 2) {
      const code = parts[0];
      const name = parts[1];
      const type = parts[2] || 'subcontractor';
      const contactPerson = parts[3] || null;
      const phone = parts[4] || null;
      const currentWorkingProject = parts[6] || 'PRJ531';

      if (code && name) {
        await prisma.corporateBusinessPartner.upsert({
          where: { code },
          update: {
            name,
            type,
            contactPerson,
            phone,
            currentWorkingProject,
            status: 'active',
          },
          create: {
            code,
            name,
            type,
            contactPerson,
            phone,
            currentWorkingProject,
            status: 'active',
          },
        });
        bpCount++;
      }
    }

    // 2. DRIVERS & OPERATORS
    else if (currentSection === 'Drivers & Operators' && parts.length >= 3) {
      const employeeCode = parts[0];
      const fullName = parts[2] || parts[1] || parts[0];
      const nicNo = parts[4] || 'N/A';
      const dailyRate = parseFloat((parts[6] || '0').replace(/,/g, '')) || 1400.0;
      const epfNo = parts[7] || null;
      const bpCode = parts[8] || 'BP1002885';

      const bp = await prisma.corporateBusinessPartner.findUnique({ where: { code: bpCode } });

      if (employeeCode) {
        await prisma.corporateEmployee.upsert({
          where: { employeeCode },
          update: {
            fullName,
            nicNo,
            epfNo,
            dailyRate,
            isOperator: true,
            corporateBusinessPartnerId: bp?.id || null,
            currentWorkingProject: 'PRJ531',
            status: 'active',
          },
          create: {
            employeeCode,
            fullName,
            nicNo,
            epfNo,
            dailyRate,
            isOperator: true,
            corporateBusinessPartnerId: bp?.id || null,
            currentWorkingProject: 'PRJ531',
            status: 'active',
          },
        });
        driverCount++;
      }
    }

    // 3. LABOR
    else if (currentSection === 'Labor' && parts.length >= 3) {
      const employeeCode = parts[0];
      const fullName = parts[2] || parts[1] || parts[0];
      const nicNo = parts[4] || 'N/A';
      const dailyRate = parseFloat((parts[5] || '0').replace(/,/g, '')) || 1400.0;
      const epfNo = parts[6] || null;
      const bpCode = parts[7] || 'BP1002885';

      const bp = await prisma.corporateBusinessPartner.findUnique({ where: { code: bpCode } });

      if (employeeCode) {
        await prisma.corporateEmployee.upsert({
          where: { employeeCode },
          update: {
            fullName,
            nicNo,
            epfNo,
            dailyRate,
            isOperator: false,
            corporateBusinessPartnerId: bp?.id || null,
            currentWorkingProject: 'PRJ531',
            status: 'active',
          },
          create: {
            employeeCode,
            fullName,
            nicNo,
            epfNo,
            dailyRate,
            isOperator: false,
            corporateBusinessPartnerId: bp?.id || null,
            currentWorkingProject: 'PRJ531',
            status: 'active',
          },
        });
        laborCount++;
      }
    }

    // 4. CORPORATE EQUIPMENT
    else if (currentSection === 'Corporate Equipment' && parts.length >= 4) {
      const erpNewCode = parts[0];
      const standardEquipmentNumber = parts[1] || erpNewCode;
      const vehicleNo = parts[2] || standardEquipmentNumber;
      const equipmentName = parts[3] || erpNewCode;
      const condition = parts[4] || 'DRY';
      const unit = (parts[5] || 'Hrs').trim();
      const minUtil = parseFloat((parts[6] || '0').replace(/,/g, '')) || 0;
      const dailyRate = parseFloat((parts[7] || '0').replace(/,/g, '')) || 0;
      const costRate = parseFloat((parts[8] || '0').replace(/,/g, '')) || dailyRate;
      const bpCode = parts[9] || 'BP1002885';

      if (standardEquipmentNumber) {
        const existing = await prisma.corporateEquipment.findFirst({
          where: { standardEquipmentNumber },
        });

        if (existing) {
          await prisma.corporateEquipment.update({
            where: { id: existing.id },
            data: {
              equipmentName,
              vehicleNo,
              condition,
              unit,
              minimumUtilization: minUtil,
              dailyRate,
              costRate,
              businessPartner: bpCode,
              currentWorkingProject: 'PRJ531',
              status: 'active',
            },
          });
        } else {
          await prisma.corporateEquipment.create({
            data: {
              standardEquipmentNumber,
              equipmentName,
              vehicleNo,
              condition,
              unit,
              minimumUtilization: minUtil,
              dailyRate,
              costRate,
              businessPartner: bpCode,
              currentWorkingProject: 'PRJ531',
              status: 'active',
            },
          });
        }
        eqCount++;
      }
    }

    // 5. ACTIVITY CODES
    else if ((currentSection === 'Activity Codes' || currentSection === 'Activity code') && parts.length >= 2) {
      const code = parts[0];
      const description = parts[1];
      const unit = parts[2] || null;

      if (code && description && !code.toLowerCase().includes('code')) {
        await prisma.corporateActivityCode.upsert({
          where: { code },
          update: { description, unit },
          create: { code, description, unit },
        });
        actCount++;
      }
    }

    // 6. PROJECTS
    else if (currentSection === 'Projects' && parts.length >= 2) {
      const projectCode = parts[0];
      const description = parts[1];
      const searchKey = parts[2] || description.slice(0, 16).toUpperCase();
      const projectManager = parts[3] || 'E0001';
      const status = 'active';
      const addressCode = parts[5] || '';
      const projectName = parts[6] || description;
      const enterpriseUnit = parts[7] || 'RDS001';
      const currency = parts[8] || 'LKR';

      if (projectCode && projectCode.startsWith('M00')) {
        const subdomain = projectCode.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        await prisma.project.upsert({
          where: { projectCode },
          update: {
            description,
            searchKey,
            projectManager,
            status,
            addressCode,
            projectName,
            enterpriseUnit,
            currency,
          },
          create: {
            projectCode,
            subdomain,
            description,
            searchKey,
            projectManager,
            status,
            addressCode,
            projectName,
            enterpriseUnit,
            currency,
          },
        });
        projCount++;
      }
    }
  }

  console.log('✅ Seeding from testdata.md Complete:');
  console.log(`   - Corporate Business Partners: ${bpCount}`);
  console.log(`   - Corporate Drivers & Operators: ${driverCount}`);
  console.log(`   - Corporate Laborers: ${laborCount}`);
  console.log(`   - Total Corporate Employees: ${driverCount + laborCount}`);
  console.log(`   - Corporate Equipment: ${eqCount}`);
  console.log(`   - Corporate Activity Codes: ${actCount}`);
  console.log(`   - Unified Projects: ${projCount}`);
}

main()
  .catch((e) => {
    console.error('Error during Master Data Seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
