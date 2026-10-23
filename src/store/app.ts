import { PaceDB } from '../db/db'
import { createAppStore } from './store'

/** 앱 전체가 공유하는 DB와 스토어 인스턴스. 테스트는 createAppStore로 별도 인스턴스를 만든다. */
export const db = new PaceDB()

/** 같은 브라우저의 다른 탭에 "데이터가 바뀌었어요"를 알리는 채널. 없는 환경에서는 그냥 건너뛴다. */
export const syncChannel: BroadcastChannel | null = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('pace-sync')

export const useApp = createAppStore(db, Date.now, { onPersisted: () => syncChannel?.postMessage('changed') })
