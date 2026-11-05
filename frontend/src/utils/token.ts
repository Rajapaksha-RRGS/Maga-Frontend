/**
 * Utility to decode and validate JWT tokens on the client side.
 */

export interface DecodedToken {
  userId?: string;
  tenantId?: string;
  projectId?: string;
  role?: string;
  fullName?: string;
  companyName?: string;
  exp?: number;
  iat?: number;
  [key: string]: any;
}

/**
 * Decode JWT token payload without external dependencies.
 */
export function decodeToken(token?: string | null): DecodedToken | null {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Convert Base64Url to Base64
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload) as DecodedToken;
  } catch {
    return null;
  }
}

/**
 * Checks if a JWT token is expired.
 * Returns true if the token is null, invalid, or expired.
 */
export function isTokenExpired(token?: string | null): boolean {
  if (!token) return true;
  const decoded = decodeToken(token);
  if (!decoded || typeof decoded.exp !== 'number') {
    return true; // If invalid or no exp field, treat as expired/untrusted
  }

  // Buffer by 5 seconds to prevent race conditions on the boundary
  const currentTime = Math.floor(Date.now() / 1000);
  return decoded.exp <= currentTime + 5;
}

/**
 * Calculates remaining milliseconds until token expires.
 * Returns 0 if already expired or invalid.
 */
export function getTokenRemainingMs(token?: string | null): number {
  if (!token) return 0;
  const decoded = decodeToken(token);
  if (!decoded || typeof decoded.exp !== 'number') return 0;

  const remainingMs = decoded.exp * 1000 - Date.now();
  return remainingMs > 0 ? remainingMs : 0;
}
