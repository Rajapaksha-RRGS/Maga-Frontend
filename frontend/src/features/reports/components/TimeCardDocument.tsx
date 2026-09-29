import React from 'react';
import type { TimeCardItem } from '../services/reportService';

interface TimeCardDocumentProps {
  card: TimeCardItem;
}

export const TimeCardDocument: React.FC<TimeCardDocumentProps> = ({ card }) => {
  const { totals, days } = card;

  return (
    <div className="time-card-sheet bg-white text-slate-900 p-6 sm:p-8 max-w-[800px] mx-auto border border-slate-350 shadow-md font-sans text-xs print:border-none print:shadow-none print:p-0 print:max-w-none print:text-[10px]">
      
      {/* ── Top EPF & NIC ── */}
      <div className="flex justify-between items-center mb-1 text-[11px] print:text-[9px]">
        <div className="flex gap-2">
          <span className="font-semibold">EPF No.</span>
          <span className="font-mono">{card.epfNo || '0'}</span>
        </div>
        <div className="flex gap-2">
          <span className="font-semibold">NIC No.</span>
          <span className="font-mono">{card.nicNo || '—'}</span>
        </div>
      </div>

      {/* ── Title Banner ── */}
      <div className="text-center mb-2">
        <h1 className="text-base sm:text-lg font-bold tracking-wide uppercase font-serif">
          {card.companyName || 'Maga Engineering (Pvt) Ltd.'}
        </h1>
        <h2 className="text-sm sm:text-base font-bold tracking-widest uppercase mt-0.5 underline">
          TIME CARD
        </h2>
      </div>

      {/* ── Employee Metadata Table ── */}
      <div className="border border-slate-900 mb-2">
        <div className="grid grid-cols-12 border-b border-slate-900">
          <div className="col-span-2 p-1 font-bold bg-slate-50 border-r border-slate-900">Name</div>
          <div className="col-span-6 p-1 font-semibold border-r border-slate-900 truncate uppercase">{card.fullName}</div>
          <div className="col-span-2 p-1 font-bold bg-slate-50 border-r border-slate-900">Month</div>
          <div className="col-span-2 p-1 font-semibold text-center font-mono">{card.month}</div>
        </div>

        <div className="grid grid-cols-12 border-b border-slate-900">
          <div className="col-span-2 p-1 font-bold bg-slate-50 border-r border-slate-900">Site</div>
          <div className="col-span-6 p-1 font-semibold border-r border-slate-900 truncate">{card.siteName}</div>
          <div className="col-span-2 p-1 font-bold bg-slate-50 border-r border-slate-900">Trade</div>
          <div className="col-span-2 p-1 font-semibold text-center truncate">{card.trade}</div>
        </div>

        <div className="grid grid-cols-12">
          <div className="col-span-2 p-1 font-bold bg-slate-50 border-r border-slate-900">Rate</div>
          <div className="col-span-3 p-1 font-mono font-semibold border-r border-slate-900">{card.dailyRate.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          <div className="col-span-2 p-1 font-bold bg-slate-50 border-r border-slate-900">Calling Name</div>
          <div className="col-span-2 p-1 font-semibold text-center border-r border-slate-900">{card.callingName}</div>
          <div className="col-span-2 p-1 font-bold bg-slate-50 border-r border-slate-900">Emp Code</div>
          <div className="col-span-1 p-1 font-mono font-bold text-center">{card.employeeCode}</div>
        </div>
      </div>

      {/* ── 31 Days Attendance Grid ── */}
      <table className="w-full border-collapse border border-slate-900 text-center text-[11px] print:text-[9px]">
        <thead>
          <tr className="bg-slate-100 font-bold border-b border-slate-900 text-[10px] print:text-[8.5px]">
            <th className="border border-slate-900 py-0.5 px-1 w-7">Key</th>
            <th className="border border-slate-900 py-0.5 px-1 w-7">Day</th>
            <th className="border border-slate-900 py-0.5 px-1 w-14">In</th>
            <th className="border border-slate-900 py-0.5 px-1 w-14">Out</th>
            <th className="border border-slate-900 py-0.5 px-1 w-12">Days</th>
            <th className="border border-slate-900 py-0.5 px-1 w-12">O.T.</th>
            <th className="border border-slate-900 py-0.5 px-1 w-12">Adv.</th>
            <th className="border border-slate-900 py-0.5 px-2">Employee's Signature</th>
            <th className="border border-slate-900 py-0.5 px-2">Authorized Signature</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => {
            const isNonWorking = d.key === 'X' || d.key === '\\' || d.key === '*' || d.key === '@';
            return (
              <tr 
                key={d.day} 
                className={[
                  'border-b border-slate-900 h-[19px] print:h-[17px]',
                  d.isOffMonth ? 'bg-slate-50 text-slate-300' : '',
                  isNonWorking ? 'bg-slate-50/50' : '',
                ].join(' ')}
              >
                <td className="border-r border-slate-900 font-bold font-mono text-center">
                  {d.key || ''}
                </td>
                <td className="border-r border-slate-900 font-bold font-mono">
                  {d.day}
                </td>
                <td className="border-r border-slate-900 font-mono text-[10px]">
                  {d.inTime && d.inTime !== '-' ? d.inTime : '-'}
                </td>
                <td className="border-r border-slate-900 font-mono text-[10px]">
                  {d.outTime && d.outTime !== '-' ? d.outTime : '-'}
                </td>
                <td className="border-r border-slate-900 font-mono font-semibold">
                  {d.daysWorked !== null && d.daysWorked > 0 ? d.daysWorked.toFixed(2) : '-'}
                </td>
                <td className="border-r border-slate-900 font-mono font-semibold">
                  {d.otHours !== null && d.otHours > 0 ? d.otHours.toFixed(2) : '-'}
                </td>
                <td className="border-r border-slate-900 font-mono">
                  {d.advance !== null && d.advance > 0 ? d.advance.toFixed(2) : '-'}
                </td>
                <td className="border-r border-slate-900 text-slate-300 font-cursive text-[9px]">
                  {/* Space for physical signature */}
                </td>
                <td className="text-slate-300 font-cursive text-[9px]">
                  {/* Space for supervisor signature */}
                </td>
              </tr>
            );
          })}

          {/* Total Row */}
          <tr className="border-t-2 border-slate-900 font-bold bg-slate-100">
            <td colSpan={4} className="border-r border-slate-900 text-left px-2 font-bold uppercase tracking-wider">
              Total
            </td>
            <td className="border-r border-slate-900 font-mono font-bold">
              {totals.totalDays.toFixed(2)}
            </td>
            <td className="border-r border-slate-900 font-mono font-bold">
              {totals.totalOtHours.toFixed(2)}
            </td>
            <td className="border-r border-slate-900 font-mono font-bold">
              {totals.deductions.advances > 0 ? totals.deductions.advances.toFixed(2) : '-'}
            </td>
            <td colSpan={2} className="bg-slate-50"></td>
          </tr>
        </tbody>
      </table>

      {/* ── Key Legend ── */}
      <div className="flex justify-between items-center py-1 px-2 border-b border-x border-slate-900 text-[10px] bg-slate-50 font-semibold print:text-[8.5px]">
        <span><strong>Key:</strong></span>
        <span>\ - Saturday</span>
        <span>X - Sunday</span>
        <span>* - Holiday</span>
        <span>@ - Shut Down</span>
      </div>

      {/* ── Earnings & Deductions Calculation Section ── */}
      <div className="grid grid-cols-12 border-x border-b border-slate-900 mt-1">
        
        {/* Left Column: Earnings Breakdown (Cols 1-7) */}
        <div className="col-span-7 border-r border-slate-900 p-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold w-24">Day</span>
            <span className="font-mono text-center w-16 underline">{totals.totalDays.toFixed(0)}</span>
            <span className="text-[10px]">x Rate (Per Day)</span>
            <span className="font-mono font-medium text-right w-16">{card.dailyRate.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            <span className="font-mono font-bold text-right w-20">{totals.basicPay.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-semibold w-24">Normal O.T.</span>
            <span className="font-mono text-center w-16 underline">{totals.totalOtHours.toFixed(2)}</span>
            <span className="text-[10px]">x Rate (Per hrs)</span>
            <span className="font-mono font-medium text-right w-16">{card.hourlyOtRate.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            <span className="font-mono font-bold text-right w-20">{totals.otPay.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>

          <div className="flex items-center justify-between text-slate-500">
            <span className="font-semibold w-24">Allowances</span>
            <span className="w-16"></span>
            <span className="text-[10px]"></span>
            <span className="w-16"></span>
            <span className="font-mono text-right w-20">-</span>
          </div>

          <div className="flex items-center justify-between text-slate-500">
            <span className="font-semibold w-24">Other Earnings</span>
            <span className="w-16"></span>
            <span className="text-[10px]"></span>
            <span className="w-16"></span>
            <span className="font-mono text-right w-20">-</span>
          </div>

          <div className="pt-2 border-t border-slate-400 flex items-center justify-between font-bold text-sm">
            <span className="uppercase tracking-wider">Gross Pay</span>
            <span className="font-mono text-base">{totals.grossPay.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Right Column: Deductions (LESS) (Cols 8-12) */}
        <div className="col-span-5 p-2 bg-slate-50/50 flex flex-col justify-between">
          <div className="space-y-0.5 text-[10.5px] print:text-[8.5px]">
            <div className="font-bold uppercase tracking-wider text-[11px] mb-1">LESS:</div>
            
            <div className="flex justify-between">
              <span>Advances</span>
              <span className="font-mono">{totals.deductions.advances > 0 ? totals.deductions.advances.toFixed(2) : '-'}</span>
            </div>
            <div className="flex justify-between">
              <span>E.P.F.</span>
              <span className="font-mono">{totals.deductions.epf > 0 ? totals.deductions.epf.toFixed(2) : '-'}</span>
            </div>
            <div className="flex justify-between">
              <span>Loans</span>
              <span className="font-mono">{totals.deductions.loans > 0 ? totals.deductions.loans.toFixed(2) : '-'}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Mess Advances</span>
              <span className="font-mono">{totals.deductions.messAdvances > 0 ? totals.deductions.messAdvances.toFixed(2) : '-'}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Advances Other Site</span>
              <span className="font-mono">-</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Festival Advances</span>
              <span className="font-mono">-</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Others</span>
              <span className="font-mono">-</span>
            </div>
          </div>

          {/* Net Pay Box */}
          <div className="mt-2 pt-1 border-t-2 border-slate-900 flex justify-between items-center font-bold text-xs bg-emerald-50/80 p-1.5 rounded border border-emerald-200">
            <span className="uppercase tracking-wider text-emerald-900">Net Payable:</span>
            <span className="font-mono text-sm text-emerald-950">{totals.netPay.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* ── Signatures & Authorization Box ── */}
      <div className="grid grid-cols-3 gap-6 pt-10 pb-2 text-center text-[10px] print:text-[8.5px]">
        <div>
          <div className="border-t border-dotted border-slate-800 pt-1 font-semibold uppercase">
            Prepared By
          </div>
          <span className="text-[9px] text-slate-500">ERP DPA</span>
        </div>

        <div>
          <div className="border-t border-dotted border-slate-800 pt-1 font-semibold uppercase">
            Checked By
          </div>
          <span className="text-[9px] text-slate-500">Time Keeper</span>
        </div>

        <div>
          <div className="border-t border-dotted border-slate-800 pt-1 font-semibold uppercase">
            Approved by
          </div>
          <span className="text-[9px] text-slate-500">PM / AGM</span>
        </div>
      </div>

    </div>
  );
};
