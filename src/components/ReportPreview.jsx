import moment from 'moment';
import { AlertTriangle } from 'lucide-react';
import { summarizeReport } from '@/lib/pdfReport';

const sameCode = (a, b) =>
  (a || '').toString().trim().toLowerCase().replace(/^0+(?=.)/, '') === (b || '').toString().trim().toLowerCase().replace(/^0+(?=.)/, '');

// True when the report header names manufacturers and none of them is the selected vendor's.
export function isOtherManufacturer(meta, vendor) {
  if (!vendor?.manufacturer_code || !meta?.manufacturers?.length) return false;
  return !meta.manufacturers.some(m => sameCode(m.code, vendor.manufacturer_code));
}

// What was read from a stock report before it is used: rows, total quantity, warehouses and the report date,
// plus a warning when the report is for another manufacturer than the selected vendor.
export default function ReportPreview({ items, meta, vendor }) {
  const { rows, quantity, warehouses } = summarizeReport(items);
  const otherManufacturer = isOtherManufacturer(meta, vendor);
  const reportManufacturers = (meta?.manufacturers || []).map(m => [m.code, m.name].filter(Boolean).join(' ')).join(', ');

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span><span className="font-semibold text-foreground">{rows.toLocaleString()}</span> rows</span>
        <span><span className="font-semibold text-foreground">{quantity.toLocaleString()}</span> pcs</span>
        <span><span className="font-semibold text-foreground">{warehouses}</span> warehouses</span>
        {meta?.report_date && (
          <span>Report date <span className="font-semibold text-foreground">{moment(meta.report_date).format('MMM D, YYYY HH:mm')}</span></span>
        )}
        {reportManufacturers && <span>Manufacturer <span className="font-semibold text-foreground">{reportManufacturers}</span></span>}
      </div>
      {otherManufacturer && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-warning/10 text-warning text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          <span>
            This report is for manufacturer {reportManufacturers}, but the selected vendor {vendor.name} has
            manufacturer code {vendor.manufacturer_code}. Check that the right vendor is selected.
          </span>
        </div>
      )}
    </div>
  );
}
