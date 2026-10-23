// 백업 JSON 입출력. 문자열을 받고 문자열을 돌려줄 뿐 파일·DOM 에는 접근하지 않는다.
import { BACKUP_VERSION, failure, type AppData, type BackupFile, type ImportResult } from './model'
import { migrateBackup } from './migrate'

export function createBackup(data: AppData, nowIso: string): BackupFile {
  return { app: 'godo', version: BACKUP_VERSION, exportedAt: nowIso, data: { ...data } }
}

/** 사람이 열어 볼 수 있게 들여쓰기 2칸으로 쓴다. */
export function serializeBackup(file: BackupFile): string {
  return JSON.stringify(file, null, 2)
}

export function parseBackup(text: string): ImportResult<BackupFile> {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return failure('JSON 형식이 올바르지 않아요. 파일이 깨졌거나 백업 파일이 아닐 수 있어요.')
  }
  return migrateBackup(raw)
}
