// 백업 형식 버전 변환 체인. 각 단계는 vN 의 data 를 v(N+1) 의 data 로 바꾸는 순수 함수다.
import { z } from 'zod'
import { BACKUP_VERSION, failure, type BackupFile, type ImportResult } from './model'
import { parseAppData } from './validate'

export type RawData = Readonly<Record<string, unknown>>
export type MigrationStep = (data: RawData) => RawData

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * v0 -> v1. v0 은 작업에 날짜가 마감일(dueDate) 하나뿐이던 가상의 초기 형식이다.
 * v1 에서 시작일을 분리했으므로 기존 날짜가 계속 "오늘" 목록에 뜨도록 startDate 에 복사하고 dueDate 는 그대로 둔다.
 */
const v0ToV1: MigrationStep = (data) => {
  if (!Array.isArray(data.tasks)) return data
  const tasks: unknown[] = data.tasks.map((task: unknown) => {
    if (!isRecord(task) || 'startDate' in task) return task
    return { ...task, startDate: task.dueDate ?? null }
  })
  return { ...data, tasks }
}

/**
 * v1 -> v2. F12(시간대 템플릿·습관 블록)에서 생긴 필드를 채운다.
 * 둘 다 "없음"이 기본이라 예전 백업의 뜻이 달라지지 않는다.
 */
const v1ToV2: MigrationStep = (data) => {
  const habits = Array.isArray(data.habits)
    ? data.habits.map((habit: unknown) => (isRecord(habit) && !('block' in habit) ? { ...habit, block: null } : habit))
    : data.habits
  const settings =
    isRecord(data.settings) && !('frames' in data.settings) ? { ...data.settings, frames: [] } : data.settings
  return { ...data, habits, settings }
}

/** 키 N = "vN 을 v(N+1) 로 올리는 단계". 새 버전을 추가할 때 한 줄씩 더한다. */
const MIGRATIONS: Readonly<Record<number, MigrationStep>> = { 0: v0ToV1, 1: v1ToV2 }

export type MigrationResult = { ok: true; value: RawData } | { ok: false; error: string }

export function applyMigrations(
  data: RawData,
  fromVersion: number,
  toVersion: number,
  steps: Readonly<Record<number, MigrationStep>>,
): MigrationResult {
  let current = data
  for (let version = fromVersion; version < toVersion; version += 1) {
    const step = steps[version]
    if (!step) return { ok: false, error: `v${version} 백업을 v${version + 1} 로 바꾸는 방법을 몰라요.` }
    current = step(current)
  }
  return { ok: true, value: current }
}

const envelopeSchema = z.object(
  {
    app: z.literal('pace', { error: 'Pace 백업 파일이 아니에요.' }),
    version: z
      .number({ error: '백업 버전 정보가 올바르지 않아요.' })
      .int({ error: '백업 버전 정보가 올바르지 않아요.' })
      .min(0, { error: '백업 버전 정보가 올바르지 않아요.' }),
    exportedAt: z
      .string({ error: '내보낸 시각(exportedAt)이 올바르지 않아요.' })
      .refine((s) => !Number.isNaN(Date.parse(s)), { error: '내보낸 시각(exportedAt)이 올바르지 않아요.' }),
    data: z.record(z.string(), z.unknown(), { error: '백업 데이터(data)가 올바르지 않아요.' }),
  },
  { error: '백업 파일 형식이 올바르지 않아요. Pace 에서 내보낸 JSON 파일인지 확인해 주세요.' },
)

/** 이미 JSON 으로 읽은 값을 받아 현재 버전으로 올린 뒤 검증한다. 현재 버전이면 변환 없이 검증만 한다. */
export function migrateBackup(raw: unknown): ImportResult<BackupFile> {
  const envelope = envelopeSchema.safeParse(raw)
  if (!envelope.success) return failure(envelope.error.issues[0]?.message ?? '백업 파일 형식이 올바르지 않아요.')

  const { version, exportedAt, data } = envelope.data
  if (version > BACKUP_VERSION) {
    return failure(`이 백업은 더 새로운 버전(v${version})으로 만들어졌어요. 앱을 업데이트한 뒤 다시 시도해 주세요.`)
  }

  const migrated = applyMigrations(data, version, BACKUP_VERSION, MIGRATIONS)
  if (!migrated.ok) return failure(migrated.error)

  const parsed = parseAppData(migrated.value)
  if (!parsed.ok) return parsed
  return {
    ok: true,
    value: { app: 'pace', version: BACKUP_VERSION, exportedAt, data: parsed.value },
    warnings: parsed.warnings,
  }
}
