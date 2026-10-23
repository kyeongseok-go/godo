import { useState } from 'react'
import { DangerSection } from './DangerSection'
import { ExportSection } from './ExportSection'
import { ImportSection } from './ImportSection'
import { SnapshotSection } from './SnapshotSection'
import { TrashSection } from './TrashSection'
import './data.css'

/** 설정의 데이터 탭. 설정 화면이 열릴 때 동적으로 불러온다. */
export function DataTab() {
  // 가져오기·전체 삭제는 스냅샷 목록을 바꾸므로(덮어쓰기 직전 스냅샷, 스냅샷 삭제) 목록을 다시 읽게 알린다.
  const [snapshotVersion, setSnapshotVersion] = useState(0)
  const snapshotsChanged = (): void => setSnapshotVersion((v) => v + 1)

  return (
    <>
      <ExportSection />
      <ImportSection onApplied={snapshotsChanged} />
      <SnapshotSection version={snapshotVersion} />
      <TrashSection />
      <DangerSection onWiped={snapshotsChanged} />
    </>
  )
}
