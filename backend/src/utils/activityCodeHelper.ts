/**
 * activityCodeHelper.ts
 *
 * Categorizes Activity Codes into:
 * 1. STANDARD_MASTER: Standard 00-00-00-00 BOQ codes. Can have derived sub-activities.
 * 2. DERIVED_CHILD: 00-00-00-00 with suffix (-M, -E, /01, etc.). Automatically linked to parent.
 * 3. STANDALONE_SPECIAL: Non-standard codes (ZOTHE, ZIDLE, ZFUEL, ZMATS, etc.). Never divided.
 */

export const ACTIVITY_CODE_REGEX = /^(\d{2}-\d{2}-\d{2}-\d{2})(?:[-/.]([A-Za-z0-9_-]+)|([A-Za-z0-9]+))?$/i;

export type ActivityClassificationType = 'STANDARD_MASTER' | 'DERIVED_CHILD' | 'STANDALONE_SPECIAL';

export interface ActivityClassification {
  type: ActivityClassificationType;
  baseCode: string;
  suffix: string | null;
  isDivisible: boolean;
}

export function classifyActivityCode(rawCode: string): ActivityClassification {
  const code = (rawCode || '').trim().toUpperCase();
  const match = code.match(ACTIVITY_CODE_REGEX);

  if (!match) {
    return {
      type: 'STANDALONE_SPECIAL',
      baseCode: code,
      suffix: null,
      isDivisible: false,
    };
  }

  const baseCode = match[1];
  const suffix = match[2] || match[3] || null;

  if (!suffix) {
    return {
      type: 'STANDARD_MASTER',
      baseCode,
      suffix: null,
      isDivisible: true,
    };
  }

  return {
    type: 'DERIVED_CHILD',
    baseCode,
    suffix,
    isDivisible: false,
  };
}
