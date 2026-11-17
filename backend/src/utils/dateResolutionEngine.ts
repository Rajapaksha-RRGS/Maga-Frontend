/**
 * dateResolutionEngine.ts
 * 
 * Strict Single-Format Date Validator and Month Boundary Enforcement Engine.
 * 
 * Rules:
 * 1. Single Strict Format: DD/MM/YYYY (or DD-MM-YYYY, or ISO YYYY-MM-DD).
 *    - Part 0 is strictly DAY (1-31).
 *    - Part 1 is strictly MONTH (1-12).
 *    - Part 2 is strictly YEAR (YYYY).
 *    NO auto-guessing. NO automatic swapping of day and month.
 * 
 * 2. Explicit Target Period Parameters:
 *    - targetYear (e.g. 2026)
 *    - targetMonth (e.g. 7 for July)
 * 
 * 3. Strict Boundary Validation:
 *    - If row's year !== targetYear -> ERROR: Year mismatch.
 *    - If row's month !== targetMonth -> ERROR: Month mismatch (Date must be DD/MM/YYYY).
 *    - If row's day is invalid for that month/year (e.g. 31/02, 31/04) -> ERROR: Invalid calendar day.
 * 
 * 4. Error Transparency:
 *    - Collects all format/date errors with line numbers.
 *    - Aborts upload if any date is invalid or out-of-period.
 */

export interface StrictDateConfig {
  targetYear: number;
  targetMonth: number; // 1 - 12
}

export interface StrictDateResult {
  isValid: boolean;
  date: Date | null;
  day?: number;
  month?: number;
  year?: number;
  error?: string;
}

export interface DatasetDateAudit {
  targetYear: number;
  targetMonth: number;
  targetPeriodFormatted: string; // e.g. "2026-07"
  totalDatesChecked: number;
  validDatesCount: number;
  invalidDatesCount: number;
  formatErrors: Array<{
    line: number;
    rawDate: string;
    reason: string;
  }>;
}

export class StrictDateValidator {
  private targetYear: number;
  private targetMonth: number;

  constructor(config: StrictDateConfig) {
    if (!config.targetYear || isNaN(config.targetYear) || config.targetYear < 2000 || config.targetYear > 2100) {
      throw new Error(`Invalid targetYear: ${config.targetYear}. Must be between 2000 and 2100.`);
    }
    if (!config.targetMonth || isNaN(config.targetMonth) || config.targetMonth < 1 || config.targetMonth > 12) {
      throw new Error(`Invalid targetMonth: ${config.targetMonth}. Must be between 1 and 12.`);
    }
    this.targetYear = config.targetYear;
    this.targetMonth = config.targetMonth;
  }

  get targetPeriodString(): string {
    return `${this.targetYear}-${String(this.targetMonth).padStart(2, '0')}`;
  }

  get expectedFormatName(): string {
    return 'DD/MM/YYYY';
  }

  /**
   * Strictly validates and parses a single date string.
   * Expects DD/MM/YYYY (or DD-MM-YYYY, or YYYY-MM-DD).
   * Verifies that the date belongs strictly to the configured targetYear and targetMonth.
   */
  validateDate(rawVal: string | undefined | null, lineNum?: number): StrictDateResult {
    if (!rawVal || typeof rawVal !== 'string') {
      return { isValid: false, date: null, error: 'Missing or empty date field.' };
    }

    const clean = rawVal.trim();
    if (!clean) {
      return { isValid: false, date: null, error: 'Empty date string.' };
    }

    let day: number;
    let month: number;
    let year: number;

    // Support ISO YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const parts = clean.split('-').map(Number);
      year = parts[0];
      month = parts[1];
      day = parts[2];
    } else {
      // Standard DD/MM/YYYY or DD-MM-YYYY
      const delimiter = clean.includes('/') ? '/' : clean.includes('-') ? '-' : clean.includes('.') ? '.' : null;
      if (!delimiter) {
        return {
          isValid: false,
          date: null,
          error: `Invalid date structure '${clean}'. Expected strictly ${this.expectedFormatName} (e.g. 15/07/${this.targetYear}).`,
        };
      }

      const parts = clean.split(delimiter);
      if (parts.length !== 3) {
        return {
          isValid: false,
          date: null,
          error: `Malformed date '${clean}'. Expected 3 parts in ${this.expectedFormatName} format (Day/Month/Year).`,
        };
      }

      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      let p2 = parseInt(parts[2], 10);

      if (isNaN(p0) || isNaN(p1) || isNaN(p2)) {
        return {
          isValid: false,
          date: null,
          error: `Non-numeric date components found in '${clean}'. Expected strictly ${this.expectedFormatName}.`,
        };
      }

      if (p2 < 100) p2 += 2000;

      // STRICT FORMAT: Part 0 is ALWAYS Day, Part 1 is ALWAYS Month, Part 2 is ALWAYS Year
      day = p0;
      month = p1;
      year = p2;
    }

    // 1. Strict Year Validation
    if (year !== this.targetYear) {
      return {
        isValid: false,
        date: null,
        day,
        month,
        year,
        error: `Year mismatch in '${clean}': Date has year ${year}, but required target year is ${this.targetYear}.`,
      };
    }

    // 2. Strict Month Validation (Ensures ONLY the target month is accepted)
    if (month !== this.targetMonth) {
      return {
        isValid: false,
        date: null,
        day,
        month,
        year,
        error: `Month mismatch in '${clean}': Date has month ${String(month).padStart(2, '0')}, but required billing month is ${String(this.targetMonth).padStart(2, '0')}. Please ensure date is strictly formatted as ${this.expectedFormatName} (e.g. 05/${String(this.targetMonth).padStart(2, '0')}/${this.targetYear}).`,
      };
    }

    // 3. Strict Calendar Day Range Validation (including leap years)
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (day < 1 || day > daysInMonth) {
      return {
        isValid: false,
        date: null,
        day,
        month,
        year,
        error: `Invalid calendar day ${day} in '${clean}'. Month ${String(month).padStart(2, '0')}/${year} only has ${daysInMonth} days.`,
      };
    }

    // Date is 100% strictly valid
    const date = new Date(Date.UTC(year, month - 1, day));
    return {
      isValid: true,
      date,
      day,
      month,
      year,
      error: undefined,
    };
  }

  /**
   * Pre-audits an entire array of raw date strings against the strict month/year configuration.
   */
  auditDataset(rawDatesWithLines: Array<{ line: number; rawDate: string }>): DatasetDateAudit {
    const audit: DatasetDateAudit = {
      targetYear: this.targetYear,
      targetMonth: this.targetMonth,
      targetPeriodFormatted: this.targetPeriodString,
      totalDatesChecked: rawDatesWithLines.length,
      validDatesCount: 0,
      invalidDatesCount: 0,
      formatErrors: [],
    };

    for (const item of rawDatesWithLines) {
      const result = this.validateDate(item.rawDate, item.line);
      if (result.isValid) {
        audit.validDatesCount++;
      } else {
        audit.invalidDatesCount++;
        audit.formatErrors.push({
          line: item.line,
          rawDate: item.rawDate,
          reason: result.error || 'Unknown date format error',
        });
      }
    }

    return audit;
  }
}
