import { Dialog } from '../../ui/Dialog'
import { TriageSession } from './TriageSession'

interface TriageModeProps {
  open: boolean
  onClose: () => void
}

/**
 * 받은편지함 처리 모드(F8). 받은편지함 페이지의 "정리 시작" 버튼에서 연다:
 * `<TriageMode open={open} onClose={() => setOpen(false)} />`
 * 열릴 때마다 새로 줄을 세우고, 닫으면 진행 상태를 버린다(결정은 이미 저장돼 있다).
 */
export function TriageMode({ open, onClose }: TriageModeProps) {
  return (
    <Dialog open={open} onClose={onClose} label="받은편지함 정리" width="min(46rem, calc(100vw - 2rem))">
      <TriageSession onClose={onClose} />
    </Dialog>
  )
}
