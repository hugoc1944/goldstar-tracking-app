'use client';
import React from 'react';

export type DateRange = { from?: Date; to?: Date };
export type DateRangePickerProps = {
  value: DateRange;
  onChange: (r: DateRange) => void;
  presets?: { label: string; range: DateRange }[];
};

export function DateRangePicker({ value, onChange, presets = [] }: DateRangePickerProps) {
  const toInputValue = (d?: Date) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : '');

  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
        value={toInputValue(value.from)}
        onChange={(e) => onChange({ ...value, from: e.target.value ? new Date(e.target.value) : undefined })}
      />
      <span className="text-sm text-text-muted">—</span>
      <input
        type="date"
        className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
        value={toInputValue(value.to)}
        onChange={(e) => onChange({ ...value, to: e.target.value ? new Date(e.target.value) : undefined })}
      />
      {presets.length > 0 && (
        <select
          className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
          onChange={(e) => {
            const idx = Number(e.target.value);
            if (!Number.isNaN(idx)) onChange(presets[idx].range);
          }}
          defaultValue=""
        >
          <option value="" disabled>
            Presets
          </option>
          {presets.map((p, i) => (
            <option key={p.label} value={i}>
              {p.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
