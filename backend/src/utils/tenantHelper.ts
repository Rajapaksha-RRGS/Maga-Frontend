import prisma from '../config/prisma';

/**
 * Returns a fallback active project/tenant ID when none is provided in headers/params.
 * Resolves to the first active Project, or auto-creates a default one if none exist.
 */
export const getDefaultTenantId = async (): Promise<string> => {
  const project = await prisma.project.findFirst({
    where: { status: 'active' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (project) return project.id;

  const created = await prisma.project.create({
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
    select: { id: true },
  });
  return created.id;
};

export const getDefaultProjectId = getDefaultTenantId;
