type IconProps = { className?: string }
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export const IconDashboard = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} className={className}><rect x="3" y="3" width="8" height="10" rx="1.5" /><rect x="13" y="3" width="8" height="6" rx="1.5" /><rect x="13" y="11" width="8" height="10" rx="1.5" /><rect x="3" y="15" width="8" height="6" rx="1.5" /></svg>
)
export const IconSettings = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} className={className}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></svg>
)
export const IconPackage = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} className={className}><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" /><path d="M3 8l9 5 9-5M12 13v8M7.5 5.5l9 5" /></svg>
)
export const IconUsers = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} className={className}><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c.7-3.4 3.2-5.5 6.5-5.5s5.8 2.1 6.5 5.5" /><circle cx="17.5" cy="9" r="2.6" /><path d="M15.8 14.6c2.6.3 4.4 2.2 5 5" /></svg>
)
export const IconFileText = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} className={className}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5M8 13h8M8 17h5" /></svg>
)
export const IconTruck = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} className={className}><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18.5" r="1.8" /><circle cx="17.5" cy="18.5" r="1.8" /></svg>
)
export const IconWallet = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} className={className}><path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3" /><path d="M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1h-4.5a2.5 2.5 0 0 0 0 5H21" /></svg>
)
export const IconTarget = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} className={className}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.8" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /></svg>
)
export const IconArchive = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} className={className}><rect x="2.5" y="3.5" width="19" height="4.5" rx="1" /><path d="M4 8v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M9.5 13h5" /></svg>
)
export const IconGift = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} className={className}><rect x="3" y="8.5" width="18" height="4" rx="1" /><path d="M5 12.5v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7M12 8.5v12M12 8.5c-1.2-3.6-6-4-6-1 0 1.6 1.6 1 6 1ZM12 8.5c1.2-3.6 6-4 6-1 0 1.6-1.6 1-6 1Z" /></svg>
)
export const IconFactory = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} className={className}><path d="M3 21V10l5 3.5V10l5 3.5V10l6 4v7Z" /><path d="M3 21h18M6 17h.01M10 17h.01" /></svg>
)
export const IconMap = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} className={className}><path d="M9 4 3 6.5v14L9 18l6 2.5L21 18V4l-6 2.5L9 4Z" /><path d="M9 4v14M15 6.5V20" /></svg>
)
export const IconTrendingUp = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} className={className}><path d="M3 17 9.5 10.5 14 15l7-8" /><path d="M15.5 7H21v5.5" /></svg>
)
export const IconWrench = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} className={className}><path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L3 18l3 3 6.6-6.3a4 4 0 0 0 5.1-5.4l-2.8 2.8-2.2-.6-.6-2.2Z" /></svg>
)
export const IconBell = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} className={className}><path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z" /><path d="M10 19a2 2 0 0 0 4 0" /></svg>
)
export const IconLogOut = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} className={className}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></svg>
)
export const IconMenu = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} className={className}><path d="M3 6h18M3 12h18M3 18h18" /></svg>
)
export const IconClose = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} className={className}><path d="M18 6 6 18M6 6l12 12" /></svg>
)
