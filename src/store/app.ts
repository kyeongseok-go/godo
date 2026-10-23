import { GodoDB } from '../db/db'
import { adoptLegacyData } from '../db/legacy'
import { createAppStore } from './store'

/** 앱 전체가 공유하는 DB와 스토어 인스턴스. 테스트는 createAppStore로 별도 인스턴스를 만든다. */
export const db = new GodoDB()

// 옛 이름('pace')으로 저장돼 있던 데이터를 옮겨 온다. DB 가 열리기 전에 한 번만 실행된다.
db.on('ready', (vipDb) => adoptLegacyData(vipDb), false)

/** 같은 브라우저의 다른 탭에 "데이터가 바뀌었어요"를 알리는 채널. 없는 환경에서는 그냥 건너뛴다. */
export const syncChannel: BroadcastChannel | null = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('godo-sync')

export const useApp = createAppStore(db, Date.now, { onPersisted: () => syncChannel?.postMessage('changed') })
