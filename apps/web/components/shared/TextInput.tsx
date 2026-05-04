"use client";

export default function TextInput({ label, value, onChange, autoFocus }: { label: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-navy-600 uppercase tracking-wide mb-[5px]">{label}</div>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        autoFocus={autoFocus}
        className="w-full px-[11px] py-2 text-[13px] border border-navy-200 rounded-lg outline-none font-[inherit] text-navy-900 bg-white box-border"
      />
    </div>
  );
}
