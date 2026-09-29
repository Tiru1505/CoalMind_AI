export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="9" fill="#12304d" />
      {/* strata */}
      <path d="M5 27 L15 21 L22 25 L35 17 L35 23 L22 31 L15 27 L5 33 Z" fill="#f59e0b" opacity=".95" />
      <path d="M5 33 L15 27 L22 31 L35 23 L35 29 L22 36 L15 32 L5 38 Z" fill="#b45309" opacity=".9" />
      {/* intelligence nodes */}
      <circle cx="12" cy="11" r="2.3" fill="#7eaad4" />
      <circle cx="21" cy="7" r="2.3" fill="#7eaad4" />
      <circle cx="29" cy="12" r="2.6" fill="#34d399" />
      <path d="M12 11 L21 7 L29 12 L21 16 Z" stroke="#7eaad4" strokeWidth="1.2" fill="none" />
    </svg>
  )
}
