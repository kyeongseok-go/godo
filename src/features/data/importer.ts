// 가져오기·복원·전체 삭제처럼 DB 를 직접 건드리는 부분. 순수 계산은 appData.ts 와 domain/exchange 에 있다.
import type { PaceDB } from '../../db/db'
import { clearAll, loadAll, persistChanges, persistSettings } from '../../db/persist'
import { applyImport, emptyAppData } from '../../domain/exchange'
import type { AppData, MergeMode } from '../../domain/exchange'
import type { ID, Project, Section, Task } from '../../domain/types'
import { TABLE_NAMES } from '../../store/changes'
import { appDataChanges, collectAppData } from './appData'
import { csvProjectName } from './format'
import { createSnapshot, readSnapshotData } from './snapshots'

export interface ImportContext {
  nowMs: number
  newId: () => ID
}

export interface ImportSummary {
  added: number
  updated: number
}

export async function readAppData(db: PaceDB): Promise<AppData> {
  const { entities, settings } = await loadAll(db)
  return collectAppData({ entities, settings })
}

/** 한 트랜잭션 안에서 비우고 쓴다. 쓰다 실패하면 지운 것도 되돌아가 데이터가 반쯤 남지 않는다. */
async function replaceAll(db: PaceDB, data: AppData): Promise<void> {
  await db.transaction('rw', [...TABLE_NAMES.map((t) => db.table(t)), db.settings], async () => {
    await clearAll(db)
    for (const name of TABLE_NAMES) {
      const rows = data[name]
      if (rows.length > 0) await db.table(name).bulkPut(rows)
    }
    if (data.settings) await db.settings.put(data.settings)
  })
}

/**
 * 가져온 데이터를 DB 에 반영한다. 끝난 뒤 호출 측이 `useApp.getState().reload()` 로 메모리 상태를 다시 읽어야 한다.
 * 덮어쓰기는 지우기 전에 현재 상태를 스냅샷으로 남겨 두어 되돌릴 길을 만든다.
 */
export async function importAppData(
  db: PaceDB,
  incoming: AppData,
  mode: MergeMode,
  ctx: ImportContext,
): Promise<ImportSummary> {
  const current = await readAppData(db)
  const { data, added, updated } = applyImport(current, incoming, mode)

  if (mode === 'replace') {
    await createSnapshot(db, current, ctx.nowMs, ctx.newId())
    await replaceAll(db, data)
    return { added, updated }
  }

  await persistChanges(db, appDataChanges(current, data))
  if (data.settings && data.settings !== current.settings) await persistSettings(db, data.settings)
  return { added, updated }
}

/** 스냅샷을 덮어쓰기 방식으로 복원한다. 오류는 한국어 문장으로 돌려준다. */
export async function restoreSnapshot(
  db: PaceDB,
  snapshotId: string,
  ctx: ImportContext,
): Promise<{ ok: true; summary: ImportSummary } | { ok: false; error: string }> {
  const parsed = await readSnapshotData(db, snapshotId)
  if (!parsed.ok) return parsed
  return { ok: true, summary: await importAppData(db, parsed.value, 'replace', ctx) }
}

export interface CsvImportOptions {
  projectName: string
  color: string
  order: number
  nowMs: number
  newId: () => ID
}

/** Todoist CSV 로 읽은 작업·섹션을 새 프로젝트 하나에 담은 AppData 로 바꾼다. 입력은 건드리지 않는다. */
export function buildCsvImportData(
  parsed: { tasks: readonly Task[]; sections: readonly Section[] },
  opts: CsvImportOptions,
): AppData {
  const project: Project = {
    id: opts.newId(),
    name: csvProjectName(opts.projectName),
    color: opts.color,
    icon: null,
    parentId: null,
    isFolder: false,
    archived: false,
    favorite: false,
    defaultView: 'list',
    order: opts.order,
    createdAt: opts.nowMs,
    deletedAt: null,
  }
  return {
    ...emptyAppData(),
    projects: [project],
    sections: parsed.sections.map((s) => ({ ...s, projectId: project.id })),
    tasks: parsed.tasks.map((t) => ({ ...t, projectId: project.id })),
  }
}

/** 모든 데이터와 자동 백업 스냅샷까지 지운다. 호출 측이 reload() 로 기본 상태를 다시 만든다. */
export async function wipeAllData(db: PaceDB): Promise<void> {
  await db.transaction('rw', [...TABLE_NAMES.map((t) => db.table(t)), db.settings, db.snapshots], async () => {
    await clearAll(db)
    await db.snapshots.clear()
  })
}
