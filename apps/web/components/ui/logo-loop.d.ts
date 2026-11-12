import type { ComponentType, CSSProperties, Key, ReactNode } from 'react'

export interface LogoItem {
  node?: ReactNode
  src?: string
  srcSet?: string
  sizes?: string
  width?: number
  height?: number
  alt?: string
  title?: string
  href?: string
  ariaLabel?: string
  hoverColor?: string
}

export interface LogoLoopProps {
  logos: LogoItem[]
  speed?: number
  direction?: 'left' | 'right' | 'up' | 'down'
  width?: number | string
  logoHeight?: number
  gap?: number
  pauseOnHover?: boolean
  hoverSpeed?: number
  fadeOut?: boolean
  fadeOutWidth?: number
  scaleOnHover?: boolean
  layout?: 'line' | 'wave' | 'arc' | 'orbit'
  bend?: number
  focus?: number
  magnify?: number
  tiltX?: number
  tiltY?: number
  step?: boolean
  muted?: number
  labels?: 'none' | 'inline' | 'below' | 'hover'
  draggable?: boolean
  scrollBoost?: number
  intro?: boolean
  renderItem?: (item: LogoItem, key: Key) => ReactNode
  ariaLabel?: string
  className?: string
  style?: CSSProperties
}

declare const LogoLoop: ComponentType<LogoLoopProps>

export { LogoLoop }
export default LogoLoop
