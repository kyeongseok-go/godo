import { useToasts } from '../../ui/toast'
import { downloadText } from './download'
import type { OutputTab } from './OutputPane'
import { summaryFileName } from './params'
import type { SummaryOptions } from '../../domain/stats'

const ERROR_TOAST_MS = 6000

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : '알 수 없는 오류'
}

/** 복사와 파일 저장. 실패는 삼키지 않고 토스트로 알리며, 복사가 막히면 원문 탭으로 안내한다. */
export function useSummaryOutput(
  markdown: string,
  options: Pick<SummaryOptions, 'from' | 'to'>,
  showTab: (tab: OutputTab) => void,
): { copy: () => Promise<void>; save: () => void } {
  const push = useToasts.getState().push

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(markdown)
      push('보고서를 복사했어요')
    } catch (error) {
      push(`복사하지 못했어요. 원문 탭에서 직접 선택해 복사해 주세요. (${errorMessage(error)})`, {
        tone: 'error',
        ttlMs: ERROR_TOAST_MS,
      })
      showTab('raw')
    }
  }

  const save = (): void => {
    try {
      downloadText(summaryFileName(options), markdown)
      push('.md 파일로 저장했어요')
    } catch (error) {
      push(`파일로 저장하지 못했어요. (${errorMessage(error)})`, { tone: 'error' })
    }
  }

  return { copy, save }
}
