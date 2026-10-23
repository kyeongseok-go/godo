import { useMemo } from 'react'
import type { ID, Label, Project, Section } from '../domain/types'
import { useTable } from './data'

export interface Lookups {
  projects: ReadonlyMap<ID, Project>
  sections: ReadonlyMap<ID, Section>
  labels: ReadonlyMap<ID, Label>
}

const toMap = <T extends { id: ID }>(items: readonly T[]): Map<ID, T> => new Map(items.map((i) => [i.id, i]))

/** id → 엔티티 조회용 맵. 행마다 배열을 훑지 않도록 한 번만 만든다. */
export function useLookups(): Lookups {
  const projects = useTable('projects')
  const sections = useTable('sections')
  const labels = useTable('labels')
  return useMemo(
    () => ({ projects: toMap(projects), sections: toMap(sections), labels: toMap(labels) }),
    [projects, sections, labels],
  )
}
