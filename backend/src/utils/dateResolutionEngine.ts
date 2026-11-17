/**
 * dateResolutionEngine.ts
 * 
 * Industrial-grade Date Format Detection, Anomaly Resolution,
 * and Cross-Month Contamination Protection Engine.
 * 
 * Handles:
 * 1. Excel Mixed-Locale Anomalies (e.g. days 1-12 exported as MM/DD/YYYY, days 13-31 as DD/MM/YYYY)
 * 2. Cross-Month Contamination Protection (stops data intended for one month spilling into others)
 * 3. Leap Year & Calendar Bounds Validation (e.g. rejects 29/02 on non-leap years, 31/04, etc.)
 * 4. Comprehensive Dataset Auditing & Error Ledger with Line-by-Line Tracking
 */

export interface DateAnalysisResult {
  dmyVotes: number;
  mdyVotes: number;
  isoVotes: number;
  ambiguousCount: number;
  dominantMonth: number | null;
  dominantYear: number | null;
  isMixed: boolean;
  detectedFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'MIXED_EXCEL_ANOMALY' | 'AMBIGUOUS' | 'ISO';
}

export interface DateResolveResult {
  date: Date | null;
  error?: string;
  warning?: string;
}

export class DateResolutionEngine {
  private targetMonth: number | null = null;
  private targetYear: number | null = null;
  private strictPeriod: boolean = true;

  constructor(options: { targetMonth?: number | null; targetYear?: number | null; strictPeriod?: boolean } = {}) {
    this.targetMonth = options.targetMonth || null;
    this.targetYear = options.targetYear || null;
    this.strictPeriod = options.strictPeriod !== false;
  }

  /**
   * Pre-scans all date values across the dataset to statistically discover
   * the date conventions, dominant billing month, and detect any Excel format mix-ups.
   */
  analyzeDataset(rawDates: string[]): DateAnalysisResult {
    let dmyVotes = 0;
    let mdyVotes = 0;
    let isoVotes = 0;
    const monthCounts = new Map<number, number>();
    const yearCounts = new Map<number, number>();
    let ambiguousCount = 0;

    for (const raw of rawDates) {
      if (!raw || typeof raw !== 'string') continue;
      const clean = raw.trim();
      if (!clean) continue;

      if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
        isoVotes++;
        const [y, m] = clean.split('-').map(Number);
        if (y >= 2000 && y <= 2100) yearCounts.set(y, (yearCounts.get(y) || 0) + 1);
        if (m >= 1 && m <= 12) monthCounts.set(m, (monthCounts.get(m) || 0) + 1);
        continue;
      }

      const delimiter = clean.includes('/') ? '/' : clean.includes('-') ? '-' : clean.includes('.') ? '.' : null;
      if (!delimiter) continue;
      const parts = clean.split(delimiter);
      if (parts.length !== 3) continue;

      let [p0, p1, p2] = parts.map((p) => parseInt(p, 10));
      if (isNaN(p0) || isNaN(p1) || isNaN(p2)) continue;

      let year = p2;
      let d = p0;
      let m = p1;
      if (year < 100) year += 2000;
      if (year >= 2000 && year <= 2100) {
        yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
      }

      if (d > 12 && m <= 12) {
        dmyVotes++;
        monthCounts.set(m, (monthCounts.get(m) || 0) + 1);
      } else if (m > 12 && d <= 12) {
        mdyVotes++;
        monthCounts.set(d, (monthCounts.get(d) || 0) + 1);
      } else if (d <= 12 && m <= 12) {
        ambiguousCount++;
      }
    }

    // Determine dominant month
    let dominantMonth: number | null = this.targetMonth;
    if (!dominantMonth) {
      let maxMonthCount = 0;
      for (const [m, count] of monthCounts.entries()) {
        if (count > maxMonthCount) {
          maxMonthCount = count;
          dominantMonth = m;
        }
      }
    }

    // Determine dominant year
    let dominantYear: number | null = this.targetYear;
    if (!dominantYear) {
      let maxYearCount = 0;
      for (const [y, count] of yearCounts.entries()) {
        if (count > maxYearCount) {
          maxYearCount = count;
          dominantYear = y;
        }
      }
    }

    const isMixed = dmyVotes > 0 && mdyVotes > 0;
    let detectedFormat: DateAnalysisResult['detectedFormat'] = 'AMBIGUOUS';
    if (isoVotes > 0 && dmyVotes === 0 && mdyVotes === 0) detectedFormat = 'ISO';
    else if (isMixed) detectedFormat = 'MIXED_EXCEL_ANOMALY';
    else if (dmyVotes > 0) detectedFormat = 'DD/MM/YYYY';
    else if (mdyVotes > 0) detectedFormat = 'MM/DD/YYYY';

    return {
      dmyVotes,
      mdyVotes,
      isoVotes,
      ambiguousCount,
      dominantMonth,
      dominantYear,
      isMixed,
      detectedFormat,
    };
  }

  /**
   * Resolves an individual date string with robust error handling and bounds verification.
   */
  resolveDate(rawVal: string | undefined | null, context: DateAnalysisResult): DateResolveResult {
    if (!rawVal) return { date: null, error: 'Missing date value (empty field)' };
    const clean = rawVal.trim();
    if (!clean) return { date: null, error: 'Empty date string' };

    // Standard ISO YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const [y, m, d] = clean.split('-').map(Number);
      return this._validateAndBuild(y, m, d, clean, context);
    }

    const delimiter = clean.includes('/') ? '/' : clean.includes('-') ? '-' : clean.includes('.') ? '.' : null;
    if (!delimiter) {
      return { date: null, error: `Unrecognized date format (missing delimiter '/', '-', or '.'): '${clean}'` };
    }

    const parts = clean.split(delimiter);
    if (parts.length !== 3) {
      return { date: null, error: `Malformed date structure (expected 3 parts, got ${parts.length}): '${clean}'` };
    }

    let [p0, p1, year] = parts.map((p) => parseInt(p, 10));
    if (isNaN(p0) || isNaN(p1) || isNaN(year)) {
      return { date: null, error: `Non-numeric date components found in '${clean}'` };
    }
    if (year < 100) year += 2000;
    if (year < 2000 || year > 2100) {
      return { date: null, error: `Year ${year} is out of valid range (2000-2100) in '${clean}'` };
    }

    let day: number;
    let month: number;
    let warning: string | undefined = undefined;

    // Case 1: First part is clearly day (> 12)
    if (p0 > 12 && p1 <= 12) {
      day = p0;
      month = p1;
    }
    // Case 2: Second part is clearly day (> 12)
    else if (p1 > 12 && p0 <= 12) {
      day = p1;
      month = p0;
    }
    // Case 3: Both parts are <= 12 (Ambiguous)
    else if (p0 <= 12 && p1 <= 12) {
      if (context.dominantMonth) {
        // One of the parts matches the proven billing month of the dataset
        if (p1 === context.dominantMonth && p0 !== context.dominantMonth) {
          day = p0;
          month = p1; // DD/MM/YYYY
        } else if (p0 === context.dominantMonth && p1 !== context.dominantMonth) {
          day = p1;
          month = p0; // MM/DD/YYYY (Excel US anomaly)
          warning = `Excel US locale anomaly auto-corrected: '${clean}' interpreted as Day ${day} of Month ${month}`;
        } else if (p0 === context.dominantMonth && p1 === context.dominantMonth) {
          day = p0;
          month = p1; // Same day & month (e.g. 07/07)
        } else {
          // Neither component matches the file's dominant billing month!
          return {
            date: null,
            error: `Ambiguous date '${clean}': neither component matches detected billing month (${context.dominantMonth}). Possible cross-month contamination or invalid date.`,
          };
        }
      } else {
        // Fallback default: standard DD/MM/YYYY
        day = p0;
        month = p1;
      }
    } else {
      return { date: null, error: `Invalid date components (both day and month exceed 12): '${clean}'` };
    }

    return this._validateAndBuild(year, month, day, clean, context, warning);
  }

  private _validateAndBuild(
    year: number,
    month: number,
    day: number,
    raw: string,
    context: DateAnalysisResult,
    warning?: string
  ): DateResolveResult {
    if (month < 1 || month > 12) {
      return { date: null, error: `Month value ${month} out of valid range (1-12) in '${raw}'` };
    }

    // Accurate Days-in-month calculation including leap years
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (day < 1 || day > daysInMonth) {
      return {
        date: null,
        error: `Calendar day ${day} is invalid for ${year}-${String(month).padStart(2, '0')} (max days: ${daysInMonth}) in '${raw}'`,
      };
    }

    // Strict Target Period Enforcement
    if (this.strictPeriod && context.dominantMonth && month !== context.dominantMonth) {
      return {
        date: null,
        error: `Date '${raw}' resolves to month ${month}, which does not match file billing month ${context.dominantMonth}. Cross-month entry rejected.`,
      };
    }

    const d = new Date(Date.UTC(year, month - 1, day));
    if (isNaN(d.getTime())) {
      return { date: null, error: `Internal Date conversion failed for '${raw}'` };
    }

    return { date: d, error: undefined, warning };
  }
}

