const REVOKE_DELAY_MS = 1000

/** 텍스트를 파일로 내려받는다. 브라우저가 막으면 예외를 그대로 던져 호출한 쪽이 사용자에게 알린다. */
export function downloadText(fileName: string, text: string, mime = 'text/markdown;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.rel = 'noopener'
    document.body.append(link)
    link.click()
    link.remove()
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
  }
}
