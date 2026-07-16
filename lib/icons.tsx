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
export const IconTrendingDown = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} className={className}><path d="M3 7 9.5 13.5 14 9l7 8" /><path d="M15.5 17H21v-5.5" /></svg>
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
export const IconPlus = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} strokeWidth={2.2} className={className}><path d="M12 5v14M5 12h14" /></svg>
)
export const IconSearch = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} strokeWidth={2} className={className}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
)
export const IconCamera = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} className={className}><path d="M4 8a2 2 0 0 1 2-2h1.2l.9-1.5A2 2 0 0 1 9.8 3.5h4.4a2 2 0 0 1 1.7 1l.9 1.5H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><circle cx="12" cy="13" r="3.5" /></svg>
)
export const IconEdit = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} className={className}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
)
export const IconTrash = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} className={className}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-.9 14a2 2 0 0 1-2 1.9H8.9a2 2 0 0 1-2-1.9L6 6h12ZM10 11v6M14 11v6" /></svg>
)
export const IconTag = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} className={className}><path d="m20.6 12-8-8H4v8.6l8 8a1 1 0 0 0 1.4 0l7.2-7.2a1 1 0 0 0 0-1.4Z" /><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" /></svg>
)
export const IconStar = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M12 2.5 15 9l7 1-5.2 5 1.3 7-6.1-3.3L5.9 22l1.3-7L2 10l7-1Z" /></svg>
)
export const IconMessageCircle = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} className={className}><path d="M21 12a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.95L3 21l1.5-5.2A8.4 8.4 0 0 1 3.5 12 8.5 8.5 0 0 1 12 3.5 8.5 8.5 0 0 1 21 12Z" /></svg>
)
export const IconCheck = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M20 6 9 17l-5-5" /></svg>
)
export const IconChevronDown = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} className={className}><path d="m6 9 6 6 6-6" /></svg>
)
export const IconDownload = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} className={className}><path d="M12 3v12m0 0 4.5-4.5M12 15 7.5 10.5" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
)
export const IconMapPin = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} className={className}><path d="M12 21s7-6.3 7-11.5A7 7 0 0 0 5 9.5C5 14.7 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.3" /></svg>
)
export const IconMail = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} className={className}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>
)
export const IconPhone = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} className={className}><path d="M6.6 10.8a15.5 15.5 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11 11 0 0 0 3.5.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11 11 0 0 0 .6 3.5 1 1 0 0 1-.25 1Z" /></svg>
)
