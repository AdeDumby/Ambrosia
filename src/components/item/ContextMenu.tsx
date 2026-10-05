import { useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import './ContextMenu.css'

export type MenuItem = {
  label: string
  onSelect: () => void
  color?: string
  checked?: boolean
  disabled?: boolean
}

type Props = {
  x: number
  y: number
  title?: string
  items: MenuItem[]
  onClose: () => void
}

export default function ContextMenu({ x, y, title, items, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    const rect = menu.getBoundingClientRect()
    menu.style.left = `${Math.max(4, Math.min(x, window.innerWidth - rect.width - 4))}px`
    menu.style.top = `${Math.max(4, Math.min(y, window.innerHeight - rect.height - 4))}px`
  }, [x, y])

  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) onClose()
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('blur', onClose)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('blur', onClose)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  return createPortal(
    <div ref={menuRef} className="context-menu" role="menu" style={{ left: x, top: y }}>
      {title && <div className="context-menu-title">{title}</div>}
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className="context-menu-item"
          disabled={item.disabled}
          onClick={item.onSelect}
        >
          {item.color && (
            <span className="context-menu-dot" style={{ backgroundColor: item.color }} />
          )}
          <span className="context-menu-label">{item.label}</span>
          {item.checked && <span aria-hidden="true">✓</span>}
        </button>
      ))}
    </div>,
    document.body
  )
}
