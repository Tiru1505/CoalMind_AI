import { ChevronDown } from 'lucide-react'

export default function FilterDropdown({ label, value, onChange, options, allLabel = 'All' }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; allLabel?: string | null
}) {
  return (
    <label className="flex flex-col gap-1 min-w-[150px]">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <span className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} className="input appearance-none pr-8 cursor-pointer">
          {allLabel !== null && <option value="">{allLabel}</option>}
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </span>
    </label>
  )
}
