/**
 * SACsvImportModal.tsx — Super Admin Universal CSV Bulk Import Modal
 *
 * Provides enterprise-grade CSV import with:
 *   1. Downloadable sample template (.csv)
 *   2. RFC-4180 robust client-side CSV parsing (handles quotes, commas, BOM, empty rows)
 *   3. Smart Column Alias Normalizer (auto-maps "ERP New Code" -> "employeeCode", "Trade Group" -> "tradeGroup", etc.)
 *   4. Client-side preview & pre-validation (missing required fields, duplicate warnings)
 *   5. Detailed failure ledger per row (Row #, Code, Name, Field, Reason, Actionable Suggestion)
 *   6. 1-click "Download Failed Rows (.csv)" for effortless correction in Excel
 */
import { useState, useRef, useId, useMemo } from 'react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  RefreshCw,
  HelpCircle,
  Info,
} from 'lucide-react';
import api from '../config/api';

export interface CsvImportErrorItem {
  row: number;
  code?: string;
  name?: string;
  field?: string;
  reason: string;
  suggestion?: string;
}

export interface SACsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  entityName: string;
  endpoint: string;
  sampleHeaders: string[];
  sampleData: Record<string, string>[];
  requiredFields: string[];
  columnLabels?: Record<string, string>;
  onSuccess?: () => void;
}

/**
 * Common column name aliases used in Excel/ERP exports
 */
const ALIAS_MAP: Record<string, string[]> = {
  employeeCode: ['employee code', 'emp code', 'erp new code', 'erp code', 'code', 'emp_no', 'emp no', 'employee no'],
  fullName: ['full name', 'employee name', 'name', 'calling name', 'emp name', 'worker name'],
  nicNo: ['nic no', 'nic number', 'nic', 'national id', 'id number', 'business entity identifier'],
  tradeGroup: ['trade group', 'trade', 'designation', 'occupation', 'trade code', 'trade name'],
  dailyRate: ['daily rate', 'rate (rs.)', 'rate', 'basic rate', 'daily rate (lkr)', 'rate rs'],
  costRate: ['cost rate', 'cost rate (lkr)', 'cost'],
  minimumUtilization: ['minimum utilization', 'min utilization', 'min hours'],
  epfNo: ['epf no', 'epf', 'epf number'],
  employeeType: ['employee type', 'type', 'employment type'],
  businessPartnerCode: ['business partner code', 'bp code', 'business partner', 'bp', 'supplier', 'vendor'],
  businessPartner: ['business partner', 'bp code', 'bp', 'business partner code'],
  isOperator: ['operator (y/n)', 'is operator', 'operator', 'is_operator', 'machine operator'],
  standardEquipmentNumber: ['standard equipment number', 'erp new code', 'equipment code', 'machine code', 'asset no', 'code'],
  equipmentName: ['equipment name', 'machine name', 'name', 'description', 'model'],
  vehicleNo: ['vehicle no', 'vehicle number', 'registration no', 'plate no', 'reg no'],
  unit: ['unit', 'meter unit', 'unit of measure'],
  condition: ['condition', 'machine condition'],
  code: ['code', 'partner code', 'bp code', 'activity code', 'trade code'],
  name: ['name', 'company name', 'partner name', 'trade name', 'activity name'],
  description: ['description', 'title', 'details'],
  address: ['address', 'street', 'address line 1'],
  city: ['city', 'town'],
  country: ['country'],
  contactPerson: ['contact person', 'contact', 'person'],
  phone: ['phone', 'telephone', 'mobile', 'contact no'],
  email: ['email', 'email address'],
  rating: ['rating', 'grade'],
};

/**
 * Finds the canonical sample header key that matches a given raw header string
 */
function findCanonicalKey(rawHeader: string, targetKeys: string[]): string | null {
  const cleanRaw = rawHeader.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const target of targetKeys) {
    const cleanTarget = target.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanRaw === cleanTarget) return target;

    const aliases = ALIAS_MAP[target] || [];
    for (const alias of aliases) {
      const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanRaw === cleanAlias) return target;
    }
  }
  return null;
}

/**
 * Robust RFC-4180 compliant CSV parser that handles:
 * - Windows (CRLF) and Unix (LF) line breaks
 * - Escaped double quotes ("" inside "...")
 * - Commas inside quoted fields
 * - Excel UTF-8 BOM (\uFEFF)
 * - Trailing blank rows
 */
function parseCsvText(
  text: string,
  sampleHeaders: string[],
): { headers: string[]; rows: Record<string, string>[] } {
  const cleanText = text.replace(/^\uFEFF/, '').trim();
  if (!cleanText) return { headers: [], rows: [] };

  const parsedMatrix: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentVal.trim());
      if (currentRow.some((c) => c !== '')) {
        parsedMatrix.push(currentRow);
      }
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((c) => c !== '')) {
      parsedMatrix.push(currentRow);
    }
  }

  if (parsedMatrix.length === 0) return { headers: [], rows: [] };

  const rawHeaders = parsedMatrix[0].map((h) => h.replace(/^["']|["']$/g, '').trim());

  // Build header mapping: originalHeader -> canonicalKey
  const headerMapping: Record<string, string> = {};
  rawHeaders.forEach((raw) => {
    const canonical = findCanonicalKey(raw, sampleHeaders);
    headerMapping[raw] = canonical || raw;
  });

  const rows: Record<string, string>[] = [];
  for (let r = 1; r < parsedMatrix.length; r++) {
    const rowVals = parsedMatrix[r];
    // Skip empty lines
    if (rowVals.every((val) => !val || val.trim() === '')) continue;

    const rowObj: Record<string, string> = {};
    rawHeaders.forEach((raw, idx) => {
      const val = rowVals[idx] !== undefined ? rowVals[idx].trim() : '';
      rowObj[raw] = val; // Store original
      const canonicalKey = headerMapping[raw];
      if (canonicalKey) {
        rowObj[canonicalKey] = val; // Store canonical key for system consumption
      }
    });
    rows.push(rowObj);
  }

  return { headers: sampleHeaders, rows };
}

/**
 * Converts array of objects to standard CSV string
 */
function exportToCsvString(headers: string[], data: Record<string, any>[]): string {
  const headerRow = headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(',');
  const dataRows = data.map((row) =>
    headers
      .map((h) => {
        const val = row[h] !== undefined && row[h] !== null ? String(row[h]) : '';
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(','),
  );
  return [headerRow, ...dataRows].join('\r\n');
}

/**
 * Triggers browser download of a CSV file
 */
function triggerCsvDownload(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function SACsvImportModal({
  isOpen,
  onClose,
  title,
  entityName,
  endpoint,
  sampleHeaders,
  sampleData,
  requiredFields,
  columnLabels = {},
  onSuccess,
}: SACsvImportModalProps) {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Submission & Results
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    total: number;
    importedCount: number;
    insertedCount?: number;
    updatedCount?: number;
    failedCount: number;
    errors: CsvImportErrorItem[];
  } | null>(null);

  if (!isOpen) return null;

  // ── 1. Reset state ──────────────────────────────────────────────────────────
  const handleReset = () => {
    setSelectedFile(null);
    setParsedHeaders([]);
    setParsedRows([]);
    setParseError(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── 2. Handle File Processing ───────────────────────────────────────────────
  const processFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseError('Please upload a valid .csv file format.');
      return;
    }

    setParseError(null);
    setImportResult(null);
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = (e.target?.result as string) || '';
        const { headers, rows } = parseCsvText(text, sampleHeaders);

        if (rows.length === 0) {
          setParseError('The uploaded CSV file is empty or contains only blank rows.');
          setParsedRows([]);
          setParsedHeaders([]);
          return;
        }

        setParsedHeaders(headers);
        setParsedRows(rows);
      } catch (err: any) {
        setParseError(`Failed to parse CSV file: ${err.message || 'Syntax error'}`);
      }
    };
    reader.onerror = () => {
      setParseError('Failed to read the file.');
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // ── Pre-Validation Analysis ────────────────────────────────────────────────
  const validationSummary = useMemo(() => {
    if (parsedRows.length === 0) return { missingCount: 0, duplicateCount: 0, validCount: 0 };

    let missing = 0;
    const seenCodes = new Set<string>();
    let duplicates = 0;

    const primaryKey = requiredFields[0] || 'code';

    parsedRows.forEach((row) => {
      const isMissing = requiredFields.some((f) => !row[f]?.trim());
      if (isMissing) {
        missing++;
      }
      const codeVal = row[primaryKey]?.trim().toLowerCase();
      if (codeVal) {
        if (seenCodes.has(codeVal)) {
          duplicates++;
        } else {
          seenCodes.add(codeVal);
        }
      }
    });

    return {
      missingCount: missing,
      duplicateCount: duplicates,
      validCount: parsedRows.length - missing,
    };
  }, [parsedRows, requiredFields]);

  // ── 3. Download Sample CSV Template ─────────────────────────────────────────
  const handleDownloadSample = () => {
    const csvContent = exportToCsvString(sampleHeaders, sampleData);
    const filename = `${entityName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_template.csv`;
    triggerCsvDownload(filename, csvContent);
  };

  // ── 4. Download Failed Rows CSV with Error & Suggestion Columns ─────────────
  const handleDownloadFailedRows = () => {
    if (!importResult || importResult.errors.length === 0) return;

    // Export only failed rows with clear error explanation columns
    const failedRowsData = importResult.errors.map((err) => {
      const originalRow = parsedRows[err.row - 1] || {};
      return {
        Excel_Row: err.row,
        Identifier: err.code || err.name || '—',
        Issue_Field: err.field || 'General',
        Failure_Reason: err.reason,
        Suggested_Fix: err.suggestion || '',
        ...originalRow,
      };
    });

    const exportHeaders = [
      'Excel_Row',
      'Identifier',
      'Issue_Field',
      'Failure_Reason',
      'Suggested_Fix',
      ...sampleHeaders,
    ];
    const csvContent = exportToCsvString(exportHeaders, failedRowsData);
    const filename = `${entityName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_failed_records.csv`;
    triggerCsvDownload(filename, csvContent);
  };

  // ── 5. Execute Import API Call ──────────────────────────────────────────────
  const handleExecuteImport = async () => {
    if (parsedRows.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setParseError(null);

    try {
      const res = await api.post(endpoint, { records: parsedRows });
      const data = res.data;

      const failedCount = data.failedCount ?? (data.errors ? data.errors.length : 0);
      setImportResult({
        success: data.success ?? true,
        total: data.total ?? parsedRows.length,
        importedCount: data.importedCount ?? 0,
        insertedCount: data.insertedCount ?? 0,
        updatedCount: data.updatedCount ?? 0,
        failedCount,
        errors: data.errors ?? [],
      });

      if (onSuccess && (data.importedCount ?? 0) > 0) {
        onSuccess();
      }
    } catch (err: any) {
      setParseError(
        err.response?.data?.error ||
          err.message ||
          'Failed to upload records to server. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150 sa-modal"
      style={{ colorScheme: 'light' }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-violet-100 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800 animate-in zoom-in-95 duration-150">
        {/* ── Modal Header ────────────────────────────────────────────────── */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#1A0A2E] to-[#2D1055] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-[#C9A84C] flex items-center justify-center">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
              <p className="text-[11px] text-violet-200/80">
                Bulk add or update {entityName.toLowerCase()}s using a CSV spreadsheet with smart column mapping
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Modal Body (Scrollable) ─────────────────────────────────────── */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-white text-slate-900">
          {/* Top Info Banner & Sample Download */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-violet-50/70 border border-violet-100 rounded-xl p-3.5">
            <div className="text-xs text-slate-600 space-y-0.5">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Info size={14} className="text-violet-600" />
                <span>Standard CSV Template & Column Aliases:</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Required columns:{' '}
                <span className="font-mono font-medium text-violet-700">
                  {requiredFields.join(', ')}
                </span>
                <span className="text-slate-400 ml-1.5">
                  (Smart mapping supports ERP Code, Full Name, Trade Group, etc.)
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadSample}
              className="inline-flex items-center gap-1.5 bg-white border border-violet-200 hover:border-violet-300 hover:bg-violet-50 text-violet-700 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-2xs transition-colors cursor-pointer shrink-0"
            >
              <Download size={13} className="text-[#C9A84C]" />
              <span>Download Sample (.csv)</span>
            </button>
          </div>

          {/* ── Parse / Upload Error Banner ─────────────────────────────────── */}
          {parseError && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3.5 text-xs">
              <XCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
              <div>
                <div className="font-semibold">Import Issue</div>
                <div>{parseError}</div>
              </div>
            </div>
          )}

          {/* ── Step 1: Upload Dropzone (When not submitted yet) ─────────────── */}
          {!importResult && (
            <>
              {parsedRows.length === 0 ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-violet-600 bg-violet-50/80'
                      : 'border-slate-300 hover:border-violet-400 bg-slate-50/50 hover:bg-violet-50/30'
                  }`}
                >
                  <input
                    id={fileInputId}
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-12 h-12 mx-auto rounded-full bg-violet-100/70 text-violet-700 flex items-center justify-center mb-3">
                    <UploadCloud size={24} />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">
                    Click to browse or drag & drop your CSV file here
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports .csv files exported from Excel, Google Sheets, or ERP systems
                  </p>
                </div>
              ) : (
                /* ── Step 2: Preview Parsed Rows with Pre-Validation ────────── */
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                        <CheckCircle2 size={12} className="text-emerald-600" />
                        {parsedRows.length} total rows detected
                      </span>

                      {validationSummary.missingCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                          <AlertTriangle size={12} className="text-amber-600" />
                          {validationSummary.missingCount} row{validationSummary.missingCount !== 1 ? 's' : ''} missing required fields
                        </span>
                      )}

                      {selectedFile && (
                        <span className="text-xs text-slate-400 truncate max-w-xs font-mono">
                          {selectedFile.name}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                    >
                      <RefreshCw size={12} /> Choose another file
                    </button>
                  </div>

                  {/* Preview Table (First 10 rows) */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                    <div className="overflow-x-auto max-h-60">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 text-slate-600">
                          <tr>
                            <th className="px-3 py-2 font-semibold w-12 text-center">#</th>
                            {parsedHeaders.slice(0, 6).map((header) => (
                              <th key={header} className="px-3 py-2 font-semibold">
                                {columnLabels[header] || header}
                                {requiredFields.includes(header) && (
                                  <span className="text-red-500 ml-0.5">*</span>
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {parsedRows.slice(0, 10).map((row, idx) => {
                            const isMissingReq = requiredFields.some((f) => !row[f]?.trim());
                            return (
                              <tr
                                key={idx}
                                className={
                                  isMissingReq ? 'bg-amber-50/50' : 'hover:bg-slate-50/50'
                                }
                              >
                                <td className="px-3 py-2 text-center text-slate-400 font-mono text-[11px]">
                                  {idx + 1}
                                </td>
                                {parsedHeaders.slice(0, 6).map((header) => (
                                  <td
                                    key={header}
                                    className={`px-3 py-2 font-mono text-[11px] truncate max-w-[160px] ${
                                      !row[header]?.trim() && requiredFields.includes(header)
                                        ? 'text-red-500 italic'
                                        : 'text-slate-700'
                                    }`}
                                  >
                                    {row[header]?.trim() || (
                                      <span className="text-slate-300 italic">empty</span>
                                    )}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {parsedRows.length > 10 && (
                      <div className="px-3 py-1.5 bg-slate-50/80 border-t border-slate-100 text-[11px] text-slate-400 text-center">
                        Showing first 10 of {parsedRows.length} records…
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Step 3: Execution Results View (Detailed Error Ledger & Scorecard) ── */}
          {importResult && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Summary Scorecard */}
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 ${
                  importResult.failedCount === 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : importResult.importedCount > 0
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                {importResult.failedCount === 0 ? (
                  <CheckCircle2 size={24} className="text-emerald-600 shrink-0 mt-0.5" />
                ) : importResult.importedCount > 0 ? (
                  <AlertTriangle size={24} className="text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle size={24} className="text-red-600 shrink-0 mt-0.5" />
                )}

                <div className="flex-1">
                  <h4 className="text-sm font-bold">
                    {importResult.failedCount === 0
                      ? 'Import Completed Successfully!'
                      : importResult.importedCount > 0
                        ? 'Import Completed with Partial Warnings'
                        : 'Import Failed'}
                  </h4>
                  <div className="text-xs mt-1 flex items-center gap-3 font-semibold flex-wrap">
                    <span className="text-emerald-700">
                      ✓ {importResult.importedCount} Imported
                      {importResult.insertedCount !== undefined &&
                        importResult.updatedCount !== undefined && (
                          <span className="font-normal text-[11px] ml-1">
                            ({importResult.insertedCount} new, {importResult.updatedCount} updated)
                          </span>
                        )}
                    </span>
                    {importResult.failedCount > 0 && (
                      <span className="text-red-600">
                        ✕ {importResult.failedCount} Failed / Skipped
                      </span>
                    )}
                    <span className="text-slate-500 font-normal">
                      Total: {importResult.total}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detailed Error Breakdown (If any rows failed) */}
              {importResult.errors.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <AlertTriangle size={13} className="text-amber-600" />
                      <span>Failed Records Diagnosis ({importResult.errors.length} rows):</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadFailedRows}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg shadow-2xs transition-colors cursor-pointer"
                    >
                      <Download size={13} />
                      <span>Download Failed Rows Only (.csv)</span>
                    </button>
                  </div>

                  <div className="border border-red-200/80 rounded-xl overflow-hidden bg-white max-h-72 overflow-y-auto shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-red-50/80 border-b border-red-100 text-slate-700 sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-2 w-16 text-center font-bold">Row #</th>
                          <th className="px-3 py-2 font-bold w-40">Identifier / Name</th>
                          <th className="px-3 py-2 font-bold w-32">Problem Field</th>
                          <th className="px-3 py-2 font-bold">Failure Reason & Suggested Fix</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-100/60">
                        {importResult.errors.map((err, idx) => (
                          <tr key={idx} className="hover:bg-red-50/30 transition-colors">
                            <td className="px-3 py-2.5 text-center font-mono text-xs font-semibold text-slate-600">
                              <span className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                                {err.row}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 font-medium text-slate-800">
                              <div className="font-mono text-xs font-bold text-violet-700">
                                {err.code || '—'}
                              </div>
                              {err.name && (
                                <div className="text-[11px] text-slate-500 truncate max-w-[150px]">
                                  {err.name}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-[11px] text-slate-600">
                              {err.field ? (
                                <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-semibold text-[10px]">
                                  {err.field}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-[11px]">
                              <div className="text-red-700 font-semibold mb-0.5">
                                {err.reason}
                              </div>
                              {err.suggestion && (
                                <div className="text-slate-600 flex items-start gap-1 text-[10px] mt-0.5 bg-slate-50 border border-slate-200 rounded px-2 py-1">
                                  <HelpCircle size={11} className="text-amber-500 shrink-0 mt-0.5" />
                                  <span>{err.suggestion}</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Modal Footer ────────────────────────────────────────────────── */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div>
            {importResult && (
              <button
                type="button"
                onClick={handleReset}
                className="text-xs font-medium text-violet-700 hover:text-violet-900 underline transition-colors cursor-pointer"
              >
                Upload another file
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
            >
              {importResult ? 'Close' : 'Cancel'}
            </button>

            {!importResult && (
              <button
                id="sa-confirm-import-btn"
                type="button"
                disabled={parsedRows.length === 0 || isSubmitting}
                onClick={handleExecuteImport}
                className={`flex items-center gap-2 text-xs font-semibold px-5 py-2.5 rounded-lg text-white shadow-sm transition-all cursor-pointer ${
                  parsedRows.length === 0 || isSubmitting
                    ? 'bg-slate-400 cursor-not-allowed opacity-60'
                    : 'bg-gradient-to-r from-[#1A0A2E] to-[#2D1055] hover:opacity-90 active:scale-98'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-[#C9A84C]" />
                    <span>Importing {parsedRows.length} records…</span>
                  </>
                ) : (
                  <>
                    <UploadCloud size={14} className="text-[#C9A84C]" />
                    <span>Import {parsedRows.length > 0 ? `${parsedRows.length} Records` : 'CSV'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
