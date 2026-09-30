/**
 * approvalService.ts
 *
 * Dedicated API service for Admin Labour Approval portal.
 * Handles:
 *   - Fetching daily approval overview (Submitted, Not Submitted, Approved)
 *   - Approving individual supervisor daily entries
 *   - Batch approving all submitted entries for a date
 *   - Rejecting / returning entries to draft for supervisor corrections
 */

import { API_URL, apiFetch } from '../../../config/api';

export interface ApprovalDayTypeInfo {
  name: string;
  standardHoursCap: number;
  isAllOvertime: boolean;
}

export interface ApprovalWorkerActivity {
  code: string;
  description: string;
  hours: number;
}

export interface ApprovalWorkerItem {
  employeeId: string;
  employeeCode: string;
  callingName: string;
  fullName: string;
  tradeGroup: string;
  businessPartner: string;
  inTime: string;
  outTime: string;
  hours: number;
  otHours: number;
  activities: ApprovalWorkerActivity[];
  status: string;
}

export interface ApprovalOperatorItem {
  operatorId: string;
  operatorCode: string;
  callingName: string;
  fullName: string;
  tradeGroup: string;
  inTime: string;
  outTime: string;
  hours: number;
  otHours: number;
  assignedEquipmentId: string | null;
  assignedEquipmentDisplay: string;
  status: string;
  notes?: string;
}

export interface ApprovalEquipmentItem {
  equipmentId: string;
  equipmentCode: string;
  equipmentName: string;
  vehicleNo: string;
  magaNo: string;
  condition: string;
  primaryUnit: string;
  loggedQuantity: number;
  initialMeter: number;
  finalMeter: number;
  netHours: number;
  workingHours: number;
  idleHours: number;
  fuelLiters: number;
  totalMileage: number;
  remarks?: string;
  status: string;
  splits: Array<{
    activityCode: string;
    activityDesc: string;
    unit: string;
    utilization: number;
  }>;
}

export interface SupervisorApprovalGroup {
  supervisorId: string;
  supervisorName: string;
  username: string;
  assignedCount: number;
  workedCount: number;
  totalHours: number;
  totalOvertime: number;
  submittedAt: string | null;
  approvedAt?: string | null;
  status: 'submitted' | 'approved' | 'draft' | 'not_started';
  counts?: {
    laborAssigned: number;
    laborWorked: number;
    operatorsAssigned: number;
    operatorsWorked: number;
    equipmentAssigned: number;
    equipmentRunning: number;
  };
  totals?: {
    laborHours: number;
    laborOvertime: number;
    equipmentFuel: number;
    equipmentDays: number;
  };
  workers: ApprovalWorkerItem[];
  operators?: ApprovalOperatorItem[];
  equipment?: ApprovalEquipmentItem[];
}

export interface ApprovalStats {
  totalSupervisors: number;
  submittedCount: number;
  notSubmittedCount: number;
  approvedCount: number;
  totalWorkers: number;
  labor?: {
    totalAssigned: number;
    attendedCount: number;
    totalNormalHours: number;
    totalOtHours: number;
  };
  operators?: {
    totalAssigned: number;
    deployedCount: number;
    mappedCount: number;
  };
  equipment?: {
    totalAssigned: number;
    runningCount: number;
    totalDays: number;
    totalHours: number;
    totalFuelLiters: number;
  };
}

export interface ApprovalOverviewResponse {
  date: string;
  dayType: ApprovalDayTypeInfo;
  submitted: SupervisorApprovalGroup[];
  notSubmitted: SupervisorApprovalGroup[];
  approved: SupervisorApprovalGroup[];
  stats: ApprovalStats;
}

/**
 * Fetch complete approval overview for a selected date
 */
export async function getApprovalOverview(date: string): Promise<ApprovalOverviewResponse> {
  const res = await apiFetch(`${API_URL}/time-entries/approval-overview?date=${encodeURIComponent(date)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || 'Failed to fetch approval overview');
  }
  return res.json();
}

/**
 * Approve time entries for a specific supervisor and date
 */
export async function approveSupervisor(supervisorId: string, date: string): Promise<{ success: boolean; approvedCount: number }> {
  const res = await apiFetch(`${API_URL}/time-entries/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ supervisorId, date }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || 'Failed to approve supervisor entries');
  }
  return res.json();
}

/**
 * Batch approve all submitted supervisors for a specific date
 */
export async function approveAllSubmitted(date: string): Promise<{ success: boolean; approvedCount: number }> {
  const res = await apiFetch(`${API_URL}/time-entries/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || 'Failed to batch approve entries');
  }
  return res.json();
}

/**
 * Reject supervisor submission and return back to draft for supervisor to edit
 */
export async function rejectSupervisor(supervisorId: string, date: string, reason?: string): Promise<{ success: boolean }> {
  const res = await apiFetch(`${API_URL}/time-entries/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ supervisorId, date, reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || 'Failed to return entries to draft');
  }
  return res.json();
}

/**
 * Admin adjust a worker's In/Out time and hours directly during approval
 */
export async function adminAdjustWorker(payload: {
  supervisorId: string;
  employeeId: string;
  date: string;
  inTime: string;
  outTime: string;
  hours?: number;
  overtimeHours?: number;
}): Promise<{
  success: boolean;
  employeeId: string;
  inTime: string;
  outTime: string;
  hours: number;
  overtimeHours: number;
}> {
  const res = await apiFetch(`${API_URL}/time-entries/admin-adjust`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || 'Failed to adjust worker time entry');
  }
  return res.json();
}

