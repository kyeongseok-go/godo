import { GripVertical } from 'lucide-react'
import type { HTMLAttributes } from 'react'
import './drag-grip.css'

interface DragGripProps {
  /** dnd-kit이 주는 attributes / listeners (role, tabIndex, aria-*, 키보드·포인터 핸들러) */
  attributes: HTMLAttributes<HTMLButtonElement>
  listeners: HTMLAttributes<HTMLButtonElement> | undefined
  setActivatorNodeRef: (el: HTMLElement | null) => void
  label?: string
}

/** 카드를 키보드·포인터로 끌 수 있게 하는 손잡이. 카드 안의 다른 버튼과 중첩되지 않도록 따로 둔다. */
export function DragGrip({ attributes, listeners, setActivatorNodeRef, label = '끌어서 옮기기' }: DragGripProps) {
  return (
    <button
      ref={setActivatorNodeRef}
      type="button"
      className="drag-grip"
      aria-label={label}
      {...attributes}
      {...listeners}
      onClick={(e) => e.stopPropagation()}
    >
      <GripVertical size={14} aria-hidden="true" />
    </button>
  )
}
