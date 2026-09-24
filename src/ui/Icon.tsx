import type { SVGProps } from 'react'

export type IconName =
  | 'pen' | 'moon' | 'briefcase' | 'notebook' | 'chart' | 'trophy' | 'gear' | 'people' | 'map' | 'book'
  | 'close' | 'dice' | 'check' | 'alert' | 'star' | 'yen' | 'sparkle' | 'info' | 'play' | 'pause' | 'fast' | 'faster'
  | 'plus' | 'bolt' | 'heart'

const PATHS: Record<IconName, string> = {
  pen: 'M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  briefcase: 'M3 8h18v11H3zM9 8V5h6v3M3 13h18',
  notebook: 'M6 3h12v18H6zM6 8h12M6 13h12M9 3v18',
  chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8',
  gear: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
  people: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20a6 6 0 0 1 12 0M16 4a3 3 0 0 1 0 6M21 20a5 5 0 0 0-4-4.9',
  map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
  book: 'M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z',
  close: 'M6 6l12 12M18 6L6 18',
  dice: 'M4 4h16v16H4zM8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01',
  check: 'M4 12l5 5L20 6',
  alert: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  star: 'M12 3l2.8 6 6.2.8-4.5 4.3 1.2 6.2L12 17l-5.7 3.3 1.2-6.2L3 9.8 9.2 9z',
  yen: 'M7 4l5 7 5-7M12 11v9M8 13h8M8 17h8',
  sparkle: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01',
  play: 'M7 4l12 8-12 8z',
  pause: 'M7 4h3v16H7zM14 4h3v16h-3z',
  fast: 'M4 4l8 8-8 8zM12 4l8 8-8 8z',
  faster: 'M2 5l6 7-6 7zM9 5l6 7-6 7zM16 5l6 7-6 7z',
  plus: 'M12 5v14M5 12h14',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
}

export function Icon({ name, size = 18, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
