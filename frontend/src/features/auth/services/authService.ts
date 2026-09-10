import type { AuthUser } from '../../../context/AuthContext';


export interface Tenant {
  id: string;
  company_name: string;
  subdomain: string;
  address_line1: string;
  address_line2: string;
  phone: string;
  fax: string;
  email: string;
  status?: string;
}


import { API_URL } from '../../../config/api';

export async function login(
  tenantSubdomain: string,
  username: string,
  password: string
): Promise<AuthUser> {
  // Try real backend API first
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: tenantSubdomain.trim(),
        username: username.trim(),
        password,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.user) {
        return {
          id: data.user.id,
          username: data.user.username,
          fullName: data.user.fullName,
          role: data.user.role,
          tenantId: data.user.tenantId,
          tenantName: data.user.companyName,
        };
      }
    } else {
      const errData = await res.json().catch(() => null);
      if (errData?.error) {
        throw new Error(errData.error);
      }
    }
  } catch (err: any) {
    // If it's a specific user-facing error from backend (like wrong password or company not found), throw it
    if (err.message && !err.message.includes('fetch') && !err.message.includes('Failed to fetch')) {
      throw err;
    }
    console.warn('Backend unavailable, falling back to local auth:', err);
  }

  throw new Error('Unable to sign in. Please check your credentials or network connection.');
}

export async function getTenantById(tenantId: string): Promise<Tenant | undefined> {
  try {
    const res = await fetch(`${API_URL}/tenants/${tenantId}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.id) {
        return data as Tenant;
      }
    }
  } catch (err) {
    console.warn('Backend unavailable, using mock tenant:', err);
  }

  return undefined;
}
