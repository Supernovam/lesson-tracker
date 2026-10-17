import type { ChangeEvent } from 'react';
import { constrainFrom, constrainTo, isPlausibleDate, type DateRange } from '../utils/dateRange';
import { filterControlClass } from './filterStyles';

interface DateRangeFieldsProps {
  /** Prefix for the input ids, e.g. `invoice` → `invoice-from` / `invoice-to`. */
  idPrefix: string;
  /** Accessible name prefix, e.g. `Invoice period` → "Invoice period start date". */
  ariaLabelPrefix: string;
  range: DateRange;
  onChange: (range: DateRange) => void;
}

/**
 * From / To date inputs that never let From move after To. A cleared date, or a year still
 * being typed (`0002-…`), is ignored so the last valid range stays in place. Renders inline in
 * a flex row.
 */
export function DateRangeFields({ idPrefix, ariaLabelPrefix, range, onChange }: DateRangeFieldsProps) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-from`} className="text-sm font-medium text-slate-700">
          From
        </label>
        <input
          id={`${idPrefix}-from`}
          type="date"
          value={range.from}
          max={range.to}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            if (!isPlausibleDate(event.target.value)) return;
            onChange({ from: constrainFrom(event.target.value, range.to), to: range.to });
          }}
          className={filterControlClass}
          aria-label={`${ariaLabelPrefix} start date`}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-to`} className="text-sm font-medium text-slate-700">
          To
        </label>
        <input
          id={`${idPrefix}-to`}
          type="date"
          value={range.to}
          min={range.from}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            if (!isPlausibleDate(event.target.value)) return;
            onChange({ from: range.from, to: constrainTo(range.from, event.target.value) });
          }}
          className={filterControlClass}
          aria-label={`${ariaLabelPrefix} end date`}
        />
      </div>
    </>
  );
}
