import fs from 'fs';
import path from 'path';
import prisma from '../src/config/prisma';

async function main() {
  console.log('🚀 Starting Clean Corporate Master Data Seeding from testdata.md...');

  // Upsert corporate tables to preserve existing records and insert/update new ones from testdata.md
  console.log('Seeding corporate master records (preserving existing data)...');

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

    // Split row by pipe
    const parts = line.split('|').map((p) => p.trim());

    // Skip table header lines
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

    // ─────────────────────────────────────────────────────────────────────────
    // 1. BUSINESS PARTNERS
    // Header: Code | Name | Type | Contact Person | Phone | Address | Current Working Project
    // ─────────────────────────────────────────────────────────────────────────
    if (currentSection === 'Business Partners' && parts.length >= 2) {
      const code = parts[0];
      const name = parts[1];
      const type = parts[2] || 'subcontractor';
      const contactPerson = parts[3] || null;
      const phone = parts[4] || null;
      const address = parts[5] || null;
      const currentWorkingProject = parts[6] || 'M00000531';

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

    // ─────────────────────────────────────────────────────────────────────────
    // 2. DRIVERS & OPERATORS
    // Header: Employee Code | Calling Name | Full Name | Trade Group | NIC No | Monthly Salary | Daily Rate | EPF No | BP Code | BP Name
    // ─────────────────────────────────────────────────────────────────────────
    else if (currentSection === 'Drivers & Operators' && parts.length >= 3) {
      const employeeCode = parts[0];
      const callingName = parts[1] || parts[0];
      const fullName = parts[2] || callingName;
      const tradeGroup = parts[3] || 'Driver';
      const nicNo = parts[4] || 'N/A';
      const epfNo = parts[7] || null;
      const businessPartnerCode = parts[8] || 'BP1002885';
      const businessPartnerName = parts[9] || 'Mäga Engineering (Pvt) Ltd';

      if (employeeCode) {
        await prisma.corporateEmployee.upsert({
          where: { employeeCode },
          update: {
            callingName,
            fullName,
            tradeGroup,
            nicNo,
            epfNo,
            isOperator: true,
            businessPartnerCode,
            businessPartnerName,
            currentWorkingProject: 'M00000531',
            status: 'active',
          },
          create: {
            employeeCode,
            callingName,
            fullName,
            tradeGroup,
            nicNo,
            epfNo,
            isOperator: true,
            businessPartnerCode,
            businessPartnerName,
            currentWorkingProject: 'M00000531',
            status: 'active',
          },
        });
        driverCount++;
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. LABOR
    // Header: Employee Code | Calling Name | Full Name | Trade Group | NIC No | Daily Rate | EPF No | BP Code | BP Name
    // ─────────────────────────────────────────────────────────────────────────
    else if (currentSection === 'Labor' && parts.length >= 3) {
      const employeeCode = parts[0];
      const callingName = parts[1] || parts[0];
      const fullName = parts[2] || callingName;
      const tradeGroup = parts[3] || 'General Helper';
      const nicNo = parts[4] || 'N/A';
      const epfNo = parts[6] || null;
      const businessPartnerCode = parts[7] || 'BP1002885';
      const businessPartnerName = parts[8] || 'Mäga Engineering (Pvt) Ltd';

      if (employeeCode) {
        await prisma.corporateEmployee.upsert({
          where: { employeeCode },
          update: {
            callingName,
            fullName,
            tradeGroup,
            nicNo,
            epfNo,
            isOperator: false,
            businessPartnerCode,
            businessPartnerName,
            currentWorkingProject: 'M00000531',
            status: 'active',
          },
          create: {
            employeeCode,
            callingName,
            fullName,
            tradeGroup,
            nicNo,
            epfNo,
            isOperator: false,
            businessPartnerCode,
            businessPartnerName,
            currentWorkingProject: 'M00000531',
            status: 'active',
          },
        });
        laborCount++;
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. CORPORATE EQUIPMENT
    // Header: ERP New Code | Standard Equipment Number | Vehicle No | Equipment Name | Condition | Unit | Minimum Utilization | Daily Rate | Cost Rate | BP Code | BP Name
    // ─────────────────────────────────────────────────────────────────────────
    else if (currentSection === 'Corporate Equipment' && parts.length >= 4) {
      const erpNewCode = parts[0];
      const standardEquipmentNumber = parts[1] || erpNewCode;
      const vehicleNo = parts[2] || standardEquipmentNumber;
      const equipmentName = parts[3] || erpNewCode;
      const condition = parts[4] || 'DRY';
      const rawUnit = (parts[5] || 'hrs').trim();
      
      const cleanUnit = rawUnit.toLowerCase();
      let normalizedUnit = rawUnit;
      if (cleanUnit === 'hrs' || cleanUnit === 'hr' || cleanUnit === 'hours') normalizedUnit = 'Hrs';
      else if (cleanUnit === 'day' || cleanUnit === 'days' || cleanUnit === 'd') normalizedUnit = 'Days';
      else if (cleanUnit === 'mth' || cleanUnit === 'month') normalizedUnit = 'mth';
      else if (cleanUnit === 'km') normalizedUnit = 'km';
      else if (cleanUnit === 'ton') normalizedUnit = 'ton';

      const minUtil = parseFloat((parts[6] || '0').replace(/,/g, '')) || 0;
      const dailyRate = parseFloat((parts[7] || '0').replace(/,/g, '')) || 0;
      const costRate = parseFloat((parts[8] || '0').replace(/,/g, '')) || dailyRate;
      const bpCode = parts[9] || 'BP1002885';

      if (erpNewCode) {
        await prisma.corporateEquipment.upsert({
          where: { erpNewCode },
          update: {
            standardEquipmentNumber,
            vehicleNo,
            equipmentName,
            condition,
            unit: normalizedUnit,
            primaryUnit: normalizedUnit,
            availableUnits: [normalizedUnit],
            minimumUtilization: minUtil,
            dailyRate,
            costRate,
            businessPartner: bpCode,
            currentWorkingProject: 'M00000531',
            status: 'active',
          },
          create: {
            erpNewCode,
            standardEquipmentNumber,
            vehicleNo,
            equipmentName,
            condition,
            unit: normalizedUnit,
            primaryUnit: normalizedUnit,
            availableUnits: [normalizedUnit],
            minimumUtilization: minUtil,
            dailyRate,
            costRate,
            businessPartner: bpCode,
            currentWorkingProject: 'M00000531',
            status: 'active',
          },
        });
        eqCount++;
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. ACTIVITY CODES
    // Header: Project Code | Activity Code | Description
    // ─────────────────────────────────────────────────────────────────────────
    else if (currentSection === 'Activity Codes' && parts.length >= 3) {
      const projectCode = parts[0];
      const code = parts[1];
      const description = parts[2];

      if (projectCode && code) {
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
            activityType: 'Work Package',
            unit: 'ite',
            timeUnit: 'hrs',
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
        actCount++;
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. PROJECTS
    // Header: Project Code | Description | Search Key | Project Manager | Project Status | Address Code | Project Name | Enterprise Unit | Currency
    // ─────────────────────────────────────────────────────────────────────────
    else if (currentSection === 'Projects' && parts.length >= 2) {
      const projectCode = parts[0];
      const description = parts[1];
      const searchKey = parts[2] || description.slice(0, 16).toUpperCase();
      const projectManager = parts[3] || 'E0001';
      const status = parts[4] || 'Active';
      const addressCode = parts[5] || '';
      const projectName = parts[6] || description;
      const enterpriseUnit = parts[7] || 'RDS001';
      const currency = parts[8] || 'LKR';

      if (projectCode && projectCode.startsWith('M00')) {
        await prisma.corporateProject.upsert({
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

  // ─────────────────────────────────────────────────────────────────────────
  // 7. SYNC LOCAL PROJECT EQUIPMENT UNITS FROM CORPORATE MASTER DATA
  // ─────────────────────────────────────────────────────────────────────────
  const allCorpEq = await prisma.corporateEquipment.findMany();
  let updatedLocalCount = 0;
  for (const ce of allCorpEq) {
    const res = await prisma.equipment.updateMany({
      where: {
        OR: [
          { code: ce.erpNewCode },
          { code: ce.standardEquipmentNumber },
          { magaNo: ce.standardEquipmentNumber },
        ],
      },
      data: {
        primaryUnit: ce.primaryUnit || ce.unit || 'Hrs',
        availableUnits: ce.availableUnits && ce.availableUnits.length > 0 ? ce.availableUnits : [ce.unit || 'Hrs'],
      },
    });
    updatedLocalCount += res.count;
  }

  console.log('✅ Seeding Complete:');
  console.log(`   - Corporate Business Partners: ${bpCount}`);
  console.log(`   - Corporate Drivers & Operators: ${driverCount}`);
  console.log(`   - Corporate Laborers: ${laborCount}`);
  console.log(`   - Total Corporate Employees: ${driverCount + laborCount}`);
  console.log(`   - Corporate Equipment: ${eqCount}`);
  console.log(`   - Corporate Activity Codes: ${actCount}`);
  console.log(`   - Corporate Projects: ${projCount}`);
  console.log(`   - Local Equipment Synced: ${updatedLocalCount}`);
}

main()
  .catch((e) => {
    console.error('Error during Master Data Seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
