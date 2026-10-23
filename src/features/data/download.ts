/** 글자를 파일로 내려받게 한다. 브라우저가 막으면 오류를 던지니 호출 측이 사용자에게 알려야 한다. */
export function downloadTextFile(fileName: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  // 클릭 직후 바로 해제하면 일부 브라우저에서 다운로드가 끊긴다.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 엑셀이 한글 CSV 를 깨뜨리지 않도록 UTF-8 BOM 을 붙인다. 가져올 때는 BOM 을 알아서 버린다. */
export const UTF8_BOM = '\uFEFF'
