"use client";

export default function SelectInput({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[][] }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-navy-600 uppercase tracking-wide mb-[5px]">{label}</div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-[11px] py-2 text-[13px] border border-navy-200 rounded-lg outline-none font-[inherit] text-navy-900 bg-white box-border cursor-pointer"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
