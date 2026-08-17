/**
 * reportService.ts
 *
 * Mock service for report queries and Excel export stub.
 *
 * TODO: Replace with real API calls:
 *   query(filters)   → GET  /api/reports?...
 *   exportExcel(filters) → GET /api/reports/export (returns file download)
 */

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  employeeId?: string;
  supervisorId?: string;
  activityCode?: string;
  businessPartner?: string;
}

export interface ReportRow {
  id: string;
  employeeName: string;
  date: string;
  activityCode: string;
  activityDescription: string;
  hours: number;
  overtimeHours: number;
  remarks: string;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Mock report data ──────────────────────────────────────────────────────────

const MOCK_ROWS: ReportRow[] = [
  { id: 'r-001', employeeName: 'Kamal Perera',       date: '2026-08-15', activityCode: 'EW-01', activityDescription: 'Excavation work', hours: 8,   overtimeHours: 0,   remarks: '' },
  { id: 'r-002', employeeName: 'Kamal Perera',       date: '2026-08-16', activityCode: 'CW-01', activityDescription: 'Concrete work',   hours: 8,   overtimeHours: 2,   remarks: 'Rain delay' },
  { id: 'r-003', employeeName: 'Nimal Silva',        date: '2026-08-15', activityCode: 'CW-02', activityDescription: 'Formwork',         hours: 7.5, overtimeHours: 0,   remarks: '' },
  { id: 'r-004', employeeName: 'Nimal Silva',        date: '2026-08-16', activityCode: 'CW-02', activityDescription: 'Formwork',         hours: 8,   overtimeHours: 1.5, remarks: '' },
  { id: 'r-005', employeeName: 'Sunil Fernando',     date: '2026-08-15', activityCode: 'EL-01', activityDescription: 'Electrical work',  hours: 8,   overtimeHours: 0,   remarks: '' },
  { id: 'r-006', employeeName: 'Sunil Fernando',     date: '2026-08-16', activityCode: 'EL-01', activityDescription: 'Electrical work',  hours: 6,   overtimeHours: 0,   remarks: 'Left early – medical' },
  { id: 'r-007', employeeName: 'Chaminda Rajapakse', date: '2026-08-15', activityCode: 'GW-01', activityDescription: 'General labour',   hours: 8,   overtimeHours: 0,   remarks: '' },
  { id: 'r-008', employeeName: 'Chaminda Rajapakse', date: '2026-08-16', activityCode: 'GW-01', activityDescription: 'General labour',   hours: 8,   overtimeHours: 0,   remarks: '' },
  { id: 'r-009', employeeName: 'Ruwan Jayawardena',  date: '2026-08-15', activityCode: 'PW-01', activityDescription: 'Plumbing work',    hours: 8,   overtimeHours: 1,   remarks: '' },
  { id: 'r-010', employeeName: 'Pradeep Bandara',    date: '2026-08-15', activityCode: 'WD-01', activityDescription: 'Welding work',     hours: 8,   overtimeHours: 0,   remarks: '' },
  { id: 'r-011', employeeName: 'Pradeep Bandara',    date: '2026-08-16', activityCode: 'WD-01', activityDescription: 'Welding work',     hours: 8,   overtimeHours: 2,   remarks: 'Extra shift requested' },
  { id: 'r-012', employeeName: 'Lakmal Dissanayake', date: '2026-08-15', activityCode: 'MW-01', activityDescription: 'Masonry work',     hours: 8,   overtimeHours: 0,   remarks: '' },
  { id: 'r-013', employeeName: 'Asanka Kumara',      date: '2026-08-15', activityCode: 'CW-03', activityDescription: 'Rebar work',       hours: 7,   overtimeHours: 0,   remarks: 'Material shortage' },
  { id: 'r-014', employeeName: 'Asanka Kumara',      date: '2026-08-16', activityCode: 'CW-03', activityDescription: 'Rebar work',       hours: 8,   overtimeHours: 0,   remarks: '' },
  { id: 'r-015', employeeName: 'Dinesh Wickramasinghe', date: '2026-08-15', activityCode: 'EL-01', activityDescription: 'Electrical work', hours: 8, overtimeHours: 0, remarks: '' },
  { id: 'r-016', employeeName: 'Roshan Gunawardena', date: '2026-08-16', activityCode: 'GW-01', activityDescription: 'General labour',   hours: 8,   overtimeHours: 0,   remarks: '' },
  { id: 'r-017', employeeName: 'Tharanga Abeysekara',date: '2026-08-15', activityCode: 'PW-01', activityDescription: 'Plumbing work',    hours: 8,   overtimeHours: 0,   remarks: '' },
  { id: 'r-018', employeeName: 'Sampath Ranasinghe', date: '2026-08-16', activityCode: 'MW-01', activityDescription: 'Masonry work',     hours: 8,   overtimeHours: 1,   remarks: '' },
  { id: 'r-019', employeeName: 'Udara Liyanage',     date: '2026-08-15', activityCode: 'GW-01', activityDescription: 'General labour',   hours: 8,   overtimeHours: 0,   remarks: '' },
  { id: 'r-020', employeeName: 'Ajith Mendis',       date: '2026-08-16', activityCode: 'CW-02', activityDescription: 'Formwork',         hours: 8,   overtimeHours: 0,   remarks: '' },
];

export async function query(filters: ReportFilters): Promise<ReportRow[]> {
  await delay(400);
  return MOCK_ROWS.filter((row) => {
    if (filters.dateFrom && row.date < filters.dateFrom) return false;
    if (filters.dateTo && row.date > filters.dateTo) return false;
    if (filters.employeeId && !row.employeeName.toLowerCase().includes(filters.employeeId.toLowerCase())) return false;
    if (filters.activityCode && row.activityCode !== filters.activityCode) return false;
    if (filters.businessPartner) return false; // simplified — mock doesn't join
    return true;
  });
}

/**
 * Stub for Excel export.
 *
 * TODO: Replace with a real call to the backend's exceljs export endpoint:
 *   const response = await axios.get('/api/reports/export', { params: filters, responseType: 'blob' });
 *   const url = window.URL.createObjectURL(response.data);
 *   // trigger download via an <a> element
 */
export async function exportExcel(_filters: ReportFilters): Promise<void> {
  await delay(500);
  // eslint-disable-next-line no-alert
  alert('Export to Excel: This feature will call the backend exceljs export endpoint once the API is built. (TODO)');
}
