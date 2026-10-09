import { Request, Response } from 'express';
import prisma from '../config/prisma';

// Helper to extract string param safely
const getParam = (param: string | string[] | undefined): string => {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
};

const partnerSelectOptimized = {
  id: true,
  code: true,
  name: true,
  type: true,
  contactPerson: true,
  phone: true,
  email: true,
  rating: true,
  nicNo: true,
  address: true,
  city: true,
  country: true,
  status: true,
  createdAt: true,
  _count: {
    select: {
      employees: true,
      equipment: true,
    },
  },
};

// 1. GET /api/business-partners — List all business partners
export const getAllBusinessPartners = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, search } = req.query;

    const where: Record<string, any> = {};
    if (status && typeof status === 'string' && status !== 'all') {
      where.status = status;
    }
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { contactPerson: { contains: q, mode: 'insensitive' } },
      ];
    }

    const partners = await prisma.mF_G_BusinessPartner.findMany({
      where,
      select: partnerSelectOptimized,
      orderBy: { code: 'asc' },
    });

    const formatted = partners.map((p) => ({
      ...p,
      employeeCount: p._count.employees,
      equipmentCount: p._count.equipment,
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching business partners:', error);
    res.status(500).json({ error: 'Failed to fetch business partners' });
  }
};

// 2. GET /api/business-partners/:id — Get single business partner by ID
export const getBusinessPartnerById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const partner = await prisma.mF_G_BusinessPartner.findUnique({
      where: { id },
      select: partnerSelectOptimized,
    });

    if (!partner) {
      res.status(404).json({ error: 'Business partner not found' });
      return;
    }

    res.json({
      ...partner,
      employeeCount: partner._count.employees,
      equipmentCount: partner._count.equipment,
    });
  } catch (error) {
    console.error('Error fetching business partner:', error);
    res.status(500).json({ error: 'Failed to fetch business partner' });
  }
};

// 3. GET /api/business-partners/next-code — Get next available BP code
export const getNextBusinessPartnerCode = async (_req: Request, res: Response): Promise<void> => {
  try {
    const latest = await prisma.mF_G_BusinessPartner.findFirst({
      where: {
        code: { startsWith: 'BP' },
      },
      select: { code: true },
      orderBy: { code: 'desc' },
    });

    if (!latest) {
      res.json({ nextCode: 'BP1001001' });
      return;
    }

    const currentNum = parseInt(latest.code.replace(/[^0-9]/g, ''), 10);
    if (isNaN(currentNum)) {
      res.json({ nextCode: 'BP1001001' });
      return;
    }

    const nextCode = `BP${currentNum + 1}`;
    res.json({ nextCode });
  } catch (error) {
    console.error('Error getting next code:', error);
    res.status(500).json({ error: 'Failed to generate next code' });
  }
};

// 4. POST /api/business-partners — Create business partner
export const createBusinessPartner = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, name, contactPerson, phone, email, status, type, nicNo, businessEntityIdentifier, address, city, country } = req.body || {};

    if (!code || !name) {
      res.status(400).json({ error: 'Code and Name are required fields' });
      return;
    }

    const cleanCode = String(code).trim().toUpperCase();
    const partner = await prisma.mF_G_BusinessPartner.create({
      data: {
        code: cleanCode,
        name: String(name).trim(),
        type: type ? String(type).trim() : null,
        nicNo: (nicNo || businessEntityIdentifier)?.trim() || null,
        address: address?.trim() || null,
        city: city?.trim() || null,
        country: country?.trim() || 'Sri Lanka',
        contactPerson: contactPerson?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        status: status || 'active',
      },
      select: partnerSelectOptimized,
    });

    res.status(201).json({
      ...partner,
      employeeCount: 0,
      equipmentCount: 0,
    });
  } catch (error: any) {
    console.error('Error creating business partner:', error);
    if (error.code === 'P2002') {
      res.status(409).json({ error: `Business Partner with code ${req.body.code} already exists` });
      return;
    }
    res.status(500).json({ error: 'Failed to create business partner' });
  }
};

// 5. PUT /api/business-partners/:id — Update business partner
export const updateBusinessPartner = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const { name, contactPerson, phone, email, status, type, nicNo, businessEntityIdentifier, address, city, country } = req.body || {};

    const partner = await prisma.mF_G_BusinessPartner.update({
      where: { id },
      data: {
        name: name?.trim(),
        type: type !== undefined ? (type ? String(type).trim() : null) : undefined,
        nicNo: (nicNo !== undefined || businessEntityIdentifier !== undefined) ? ((nicNo || businessEntityIdentifier)?.trim() || null) : undefined,
        address: address !== undefined ? (address?.trim() || null) : undefined,
        city: city !== undefined ? (city?.trim() || null) : undefined,
        country: country !== undefined ? (country?.trim() || 'Sri Lanka') : undefined,
        contactPerson: contactPerson?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        status: status || undefined,
      },
      select: partnerSelectOptimized,
    });

    res.json({
      ...partner,
      employeeCount: partner._count.employees,
      equipmentCount: partner._count.equipment,
    });
  } catch (error: any) {
    console.error('Error updating business partner:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Business partner not found' });
      return;
    }
    res.status(500).json({ error: 'Failed to update business partner' });
  }
};

// 6. DELETE /api/business-partners/:id — Delete business partner
export const deleteBusinessPartner = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);

    // Check if any employees or equipment are linked
    const linkedEmployees = await prisma.mF_P_Employee.count({
      where: { businessPartnerId: id },
    });
    const linkedCorpEmployees = await prisma.mF_G_Employee.count({
      where: { corporateBusinessPartnerId: id },
    });
    const linkedEquipment = await prisma.mF_P_Equipment.count({
      where: { ownerPartnerId: id },
    });

    if (linkedEmployees > 0 || linkedCorpEmployees > 0 || linkedEquipment > 0) {
      res.status(400).json({
        error: `Cannot delete: ${linkedEmployees + linkedCorpEmployees} employee(s) and ${linkedEquipment} equipment unit(s) are assigned to this Business Partner.`,
      });
      return;
    }

    await prisma.mF_G_BusinessPartner.delete({
      where: { id },
    });

    res.json({ message: 'Business partner deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting business partner:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Business partner not found' });
      return;
    }
    res.status(500).json({ error: 'Failed to delete business partner' });
  }
};

// 7. PATCH /api/business-partners/:id/status — Toggle status
export const toggleBusinessPartnerStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const { status } = req.body || {};

    if (!status || !['active', 'inactive'].includes(status)) {
      res.status(400).json({ error: 'Valid status ("active" | "inactive") is required' });
      return;
    }

    const partner = await prisma.mF_G_BusinessPartner.update({
      where: { id },
      data: { status },
      select: partnerSelectOptimized,
    });

    res.json({
      ...partner,
      employeeCount: partner._count.employees,
      equipmentCount: partner._count.equipment,
    });
  } catch (error: any) {
    console.error('Error toggling business partner status:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Business partner not found' });
      return;
    }
    res.status(500).json({ error: 'Failed to update status' });
  }
};

// 8. GET /api/business-partners/catalog — Catalog for dropdowns/pickers
export const getCorporateBusinessPartnersCatalog = async (_req: Request, res: Response): Promise<void> => {
  try {
    const list = await prisma.mF_G_BusinessPartner.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        contactPerson: true,
        phone: true,
        rating: true,
        status: true,
      },
      orderBy: { code: 'asc' },
    });
    res.json(list);
  } catch (error) {
    console.error('Error fetching corporate business partners catalog:', error);
    res.status(500).json({ error: 'Failed to fetch corporate business partners catalog' });
  }
};
