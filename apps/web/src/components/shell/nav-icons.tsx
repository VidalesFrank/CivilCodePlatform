import type { SVGProps } from 'react'

type Props = SVGProps<SVGSVGElement> & { size?: number }

function Base({ size = 18, children, ...rest }: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export function HomeIcon(props: Props) {
  return (
    <Base {...props}>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1V10.5Z" />
    </Base>
  )
}

export function FolderIcon(props: Props) {
  return (
    <Base {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </Base>
  )
}

export function UserIcon(props: Props) {
  return (
    <Base {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4 20c1.5-3.5 4.5-5.5 8-5.5s6.5 2 8 5.5" />
    </Base>
  )
}

export function UsersIcon(props: Props) {
  return (
    <Base {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M2 20c1.2-3 3.7-4.5 7-4.5s5.8 1.5 7 4.5" />
      <circle cx="17" cy="7" r="2.3" />
      <path d="M15 14c2-.3 4.5.3 6 3" />
    </Base>
  )
}

export function SearchIcon(props: Props) {
  return (
    <Base {...props}>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.3-4.3" />
    </Base>
  )
}

export function BellIcon(props: Props) {
  return (
    <Base {...props}>
      <path d="M6 10.5a6 6 0 1 1 12 0c0 3.2.8 5.2 1.8 6.5H4.2C5.2 15.7 6 13.7 6 10.5Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </Base>
  )
}

export function SunIcon(props: Props) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M5 12H3M21 12h-2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </Base>
  )
}

export function MoonIcon(props: Props) {
  return (
    <Base {...props}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
    </Base>
  )
}

export function MonitorIcon(props: Props) {
  return (
    <Base {...props}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </Base>
  )
}

export function ChevronDownIcon(props: Props) {
  return (
    <Base {...props}>
      <path d="m6 9 6 6 6-6" />
    </Base>
  )
}

export function ChevronRightIcon(props: Props) {
  return (
    <Base {...props}>
      <path d="m9 6 6 6-6 6" />
    </Base>
  )
}

export function ChevronLeftIcon(props: Props) {
  return (
    <Base {...props}>
      <path d="m15 6-6 6 6 6" />
    </Base>
  )
}

export function PlusIcon(props: Props) {
  return (
    <Base {...props}>
      <path d="M12 5v14M5 12h14" />
    </Base>
  )
}

export function SettingsIcon(props: Props) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="2.6" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
    </Base>
  )
}

export function MenuIcon(props: Props) {
  return (
    <Base {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Base>
  )
}

export function BuildingIcon(props: Props) {
  return (
    <Base {...props}>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-4h4v4" />
    </Base>
  )
}

export function CommandIcon(props: Props) {
  return (
    <Base {...props}>
      <path d="M6 9V6a2 2 0 1 1 2-2h3v10h-3a2 2 0 1 1-2-2v-1Z" />
      <path d="M18 15v3a2 2 0 1 1-2 2h-3V10h3a2 2 0 1 1 2 2v1" />
    </Base>
  )
}

export function LogOutIcon(props: Props) {
  return (
    <Base {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </Base>
  )
}

export function CheckIcon(props: Props) {
  return (
    <Base {...props}>
      <path d="m5 12 5 5L20 7" />
    </Base>
  )
}

export function ArrowRightIcon(props: Props) {
  return (
    <Base {...props}>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </Base>
  )
}

export function SparkleIcon(props: Props) {
  return (
    <Base {...props}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2" />
    </Base>
  )
}
