/**
 * migrate_activity_hierarchy.ts
 *
 * Scans all existing Activity Codes in MF_P_ActivityCode across all projects.
 * - Identifies Standard Masters (00-00-00-00)
 * - Identifies Derived Sub-Activities (00-00-00-00 + Suffix: -M, -E, /01, etc.)
 * - Links Derived Sub-Activities to their Parent Master (setting parentActivityId and isDerived = true)
 * - If a parent master does not exist in the site, auto-creates it so children are properly grouped
 * - Identifies Non-Standard Standalone Codes (ZOTHE, ZIDLE, etc.) and keeps them standalone (isDerived = false, parentActivityId = null)
 */
import prisma from '../src/config/prisma';

export const ACTIVITY_REGEX = /^(\d{2}-\d{2}-\d{2}-\d{2})(?:[-/.]([A-Za-z0-9_-]+)|([A-Za-z0-9]+))?$/i;

export function classifyActivityCode(rawCode: string) {
  const code = rawCode.trim().toUpperCase();
  const match = code.match(ACTIVITY_REGEX);

  if (!match) {
    return {
      type: 'STANDALONE_SPECIAL' as const,
      baseCode: code,
      suffix: null,
      isDivisible: false,
    };
  }

  const baseCode = match[1];
  const suffix = match[2] || match[3] || null;

  if (!suffix) {
    return {
      type: 'STANDARD_MASTER' as const,
      baseCode,
      suffix: null,
      isDivisible: true,
    };
  }

  return {
    type: 'DERIVED_CHILD' as const,
    baseCode,
    suffix,
    isDivisible: false,
  };
}

async function runMigration() {
  console.log('--- Starting Activity Code Hierarchy Migration ---');

  const projects = await prisma.mF_P_Project.findMany({
    select: { id: true, projectCode: true, projectName: true },
  });

  console.log(`Found ${projects.length} project(s) to process.\n`);

  let totalLinked = 0;
  let totalParentsCreated = 0;
  let totalStandalone = 0;
  let totalMasters = 0;

  // Pre-load all corporate codes for metadata lookup
  const corporateCodes = await prisma.mF_G_ActivityCode.findMany();
  const corpMap = new Map(corporateCodes.map((c) => [c.code.toUpperCase().trim(), c]));

  for (const project of projects) {
    const activities = await prisma.mF_P_ActivityCode.findMany({
      where: { projectId: project.id },
      select: {
        id: true,
        code: true,
        description: true,
        unit: true,
        corporateActivityCodeId: true,
        parentActivityId: true,
        isDerived: true,
      },
    });

    if (activities.length === 0) continue;

    console.log(`Processing project ${project.projectCode} (${activities.length} activity codes)...`);

    // In-memory lookup map of existing activities in this project
    const actMap = new Map<string, typeof activities[0]>();
    for (const act of activities) {
      actMap.set(act.code.toUpperCase().trim(), act);
    }

    const derivedToLink: Array<{ act: typeof activities[0]; baseCode: string }> = [];

    for (const act of activities) {
      const classification = classifyActivityCode(act.code);

      if (classification.type === 'STANDALONE_SPECIAL') {
        totalStandalone++;
        // Ensure standalone is not derived
        if (act.isDerived || act.parentActivityId) {
          await prisma.mF_P_ActivityCode.update({
            where: { id: act.id },
            data: { isDerived: false, parentActivityId: null },
          });
        }
      } else if (classification.type === 'STANDARD_MASTER') {
        totalMasters++;
        if (act.isDerived || act.parentActivityId) {
          await prisma.mF_P_ActivityCode.update({
            where: { id: act.id },
            data: { isDerived: false, parentActivityId: null },
          });
        }
      } else {
        // DERIVED_CHILD
        derivedToLink.push({ act, baseCode: classification.baseCode });
      }
    }

    // Step 1: Ensure all required parents exist in this project
    for (const { act, baseCode } of derivedToLink) {
      let parentAct = actMap.get(baseCode);

      if (!parentAct) {
        // Parent does not exist in site, let's create it
        const corpParent = corpMap.get(baseCode);
        const parentDesc =
          corpParent?.description ||
          act.description?.replace(/ - .*$/, '') || // Attempt clean description
          `Master Activity ${baseCode}`;
        const parentUnit = corpParent?.unit || act.unit || null;
        const corpId = corpParent?.id || null;

        const newParent = await prisma.mF_P_ActivityCode.create({
          data: {
            projectId: project.id,
            code: baseCode,
            description: parentDesc,
            unit: parentUnit,
            corporateActivityCodeId: corpId,
            isDerived: false,
            parentActivityId: null,
          },
          select: {
            id: true,
            code: true,
            description: true,
            unit: true,
            corporateActivityCodeId: true,
            parentActivityId: true,
            isDerived: true,
          },
        });

        actMap.set(baseCode, newParent);
        parentAct = newParent;
        totalParentsCreated++;
        console.log(`  + Auto-created missing parent master [${baseCode}] for project ${project.projectCode}`);
      }

      // Step 2: Link the child to its parent
      const finalCorpId = parentAct.corporateActivityCodeId || act.corporateActivityCodeId;
      await prisma.mF_P_ActivityCode.update({
        where: { id: act.id },
        data: {
          isDerived: true,
          parentActivityId: parentAct.id,
          corporateActivityCodeId: finalCorpId,
        },
      });

      totalLinked++;
    }
  }

  console.log('\n--- Migration Finished Successfully ---');
  console.log(`Total Master Codes: ${totalMasters}`);
  console.log(`Total Auto-Created Missing Parents: ${totalParentsCreated}`);
  console.log(`Total Derived Sub-Activities Linked: ${totalLinked}`);
  console.log(`Total Standalone Special Codes (ZOTHE, ZIDEL etc.): ${totalStandalone}`);
}

runMigration()
  .catch((err) => {
    console.error('Migration failed:', err);
  })
  .finally(() => prisma.$disconnect());
