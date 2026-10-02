import fs from 'fs';
import path from 'path';
import prisma from '../src/config/prisma';

// Helper function to parse CSV text into array of key-value objects
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const results: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Split by comma while respecting quoted strings
    const values: string[] = [];
    let insideQuote = false;
    let currentValue = '';

    for (let charIndex = 0; charIndex < line.length; charIndex++) {
      const char = line[charIndex];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        values.push(currentValue.trim().replace(/^"|"$/g, ''));
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim().replace(/^"|"$/g, ''));

    const rowObj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      rowObj[header] = values[idx] !== undefined ? values[idx] : '';
    });
    results.push(rowObj);
  }

  return results;
}

async function main() {
  console.log('🚀 Starting Clean Master Data Seeding from CSV Files...');

  const csvDir = path.resolve(__dirname, 'csv');

  // 1. Business Partners CSV
  const bpFile = path.join(csvDir, 'business_partners.csv');
  if (fs.existsSync(bpFile)) {
    const bpRows = parseCSV(fs.readFileSync(bpFile, 'utf8'));
    for (const row of bpRows) {
      if (row.code && row.name) {
        await prisma.corporateBusinessPartner.upsert({
          where: { code: row.code },
          update: {
            name: row.name,
            type: row.type || 'subcontractor',
            contactPerson: row.contactPerson || null,
            phone: row.phone || null,
            currentWorkingProject: row.currentWorkingProject || 'M00000531',
            status: 'active',
          },
          create: {
            code: row.code,
            name: row.name,
            type: row.type || 'subcontractor',
            contactPerson: row.contactPerson || null,
            phone: row.phone || null,
            currentWorkingProject: row.currentWorkingProject || 'M00000531',
            status: 'active',
          },
        });
      }
    }
    console.log(`✅ Business Partners seeded from CSV (${bpRows.length} records)`);
  }

  // 2. Employees CSV
  const empFile = path.join(csvDir, 'employees.csv');
  if (fs.existsSync(empFile)) {
    const empRows = parseCSV(fs.readFileSync(empFile, 'utf8'));
    for (const row of empRows) {
      if (row.employeeCode) {
        await prisma.corporateEmployee.upsert({
          where: { employeeCode: row.employeeCode },
          update: {
            callingName: row.callingName || row.employeeCode,
            fullName: row.fullName || row.callingName || row.employeeCode,
            tradeGroup: row.tradeGroup || 'General Helper',
            nicNo: row.nicNo || 'N/A',
            epfNo: row.epfNo || null,
            isOperator: row.isOperator === 'true',
            businessPartnerCode: row.businessPartnerCode || 'BP1002885',
            businessPartnerName: row.businessPartnerName || 'Mäga Engineering (Pvt) Ltd',
            currentWorkingProject: 'M00000531',
            status: 'active',
          },
          create: {
            employeeCode: row.employeeCode,
            callingName: row.callingName || row.employeeCode,
            fullName: row.fullName || row.callingName || row.employeeCode,
            tradeGroup: row.tradeGroup || 'General Helper',
            nicNo: row.nicNo || 'N/A',
            epfNo: row.epfNo || null,
            isOperator: row.isOperator === 'true',
            businessPartnerCode: row.businessPartnerCode || 'BP1002885',
            businessPartnerName: row.businessPartnerName || 'Mäga Engineering (Pvt) Ltd',
            currentWorkingProject: 'M00000531',
            status: 'active',
          },
        });
      }
    }
    console.log(`✅ Employees seeded from CSV (${empRows.length} records)`);
  }

  // 3. Equipment CSV
  const eqFile = path.join(csvDir, 'equipment.csv');
  if (fs.existsSync(eqFile)) {
    const eqRows = parseCSV(fs.readFileSync(eqFile, 'utf8'));
    for (const row of eqRows) {
      if (row.erpNewCode) {
        const unit = row.unit || 'Hrs';
        const minUtil = parseFloat(row.minimumUtilization) || 0;
        const dailyRate = parseFloat(row.dailyRate) || 0;
        const costRate = parseFloat(row.costRate) || dailyRate;

        await prisma.corporateEquipment.upsert({
          where: { erpNewCode: row.erpNewCode },
          update: {
            standardEquipmentNumber: row.standardEquipmentNumber || row.erpNewCode,
            vehicleNo: row.vehicleNo || row.standardEquipmentNumber,
            equipmentName: row.equipmentName || row.erpNewCode,
            condition: row.condition || 'DRY',
            unit,
            primaryUnit: unit,
            availableUnits: [unit],
            minimumUtilization: minUtil,
            dailyRate,
            costRate,
            businessPartner: row.businessPartner || 'BP1002885',
            currentWorkingProject: 'M00000531',
            status: 'active',
          },
          create: {
            erpNewCode: row.erpNewCode,
            standardEquipmentNumber: row.standardEquipmentNumber || row.erpNewCode,
            vehicleNo: row.vehicleNo || row.standardEquipmentNumber,
            equipmentName: row.equipmentName || row.erpNewCode,
            condition: row.condition || 'DRY',
            unit,
            primaryUnit: unit,
            availableUnits: [unit],
            minimumUtilization: minUtil,
            dailyRate,
            costRate,
            businessPartner: row.businessPartner || 'BP1002885',
            currentWorkingProject: 'M00000531',
            status: 'active',
          },
        });
      }
    }
    console.log(`✅ Equipment seeded from CSV (${eqRows.length} records)`);
  }

  // 4. Activity Codes CSV
  const actFile = path.join(csvDir, 'activity_codes.csv');
  if (fs.existsSync(actFile)) {
    const actRows = parseCSV(fs.readFileSync(actFile, 'utf8'));
    for (const row of actRows) {
      const projectCode = row.projectCode || 'M00000531';
      const code = row.code;
      const description = row.description || code;

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
            activityType: row.activityType || 'Work Package',
            unit: row.unit || 'ite',
            timeUnit: row.timeUnit || 'hrs',
            currentWorkingProject: projectCode,
          },
          create: {
            projectCode,
            code,
            description,
            searchKey: description.slice(0, 16).toUpperCase(),
            activityType: row.activityType || 'Work Package',
            unit: row.unit || 'ite',
            timeUnit: row.timeUnit || 'hrs',
            currentWorkingProject: projectCode,
          },
        });
      }
    }
    console.log(`✅ Activity Codes seeded from CSV (${actRows.length} records)`);
  }

  console.log('🎉 CSV Master Data Seeding Complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error Seeding CSV Data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
