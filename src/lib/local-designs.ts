import type { DesignRecord, PageData } from '@/lib/types'
import type { DesignMeta } from '@/components/dashboard/hooks'

const LOCAL_DESIGNS_KEY = 'sjdesign:local-designs:v1'

export interface StoredLocalDesign extends DesignRecord {
  ownerId: string | null
  deletedAt: string | null
}

export function isLocalDesignId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith('local_')
}

function readAll(): StoredLocalDesign[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LOCAL_DESIGNS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as StoredLocalDesign[]) : []
  } catch {
    return []
  }
}

function writeAll(items: StoredLocalDesign[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LOCAL_DESIGNS_KEY, JSON.stringify(items))
  } catch {
    // If quota is exceeded due to large thumbnails, retry without thumbnails on older items
    try {
      const slim = items.map((d, idx) => (idx > 5 ? { ...d, thumbnail: null } : d))
      window.localStorage.setItem(LOCAL_DESIGNS_KEY, JSON.stringify(slim))
    } catch {
      /* storage unavailable */
    }
  }
}

export function toDesignMeta(d: StoredLocalDesign): DesignMeta {
  return {
    id: d.id,
    name: d.name,
    width: d.width,
    height: d.height,
    thumbnail: d.thumbnail ?? null,
    source: d.source ?? 'blank',
    ownerId: d.ownerId ?? null,
    claimable: false,
    mine: true,
    deletedAt: d.deletedAt ?? null,
    createdAt: d.createdAt ?? new Date().toISOString(),
    updatedAt: d.updatedAt ?? new Date().toISOString(),
  }
}

export function listLocalDesigns(trash = false): DesignMeta[] {
  const all = readAll()
  return all
    .filter((d) => (trash ? d.deletedAt !== null : d.deletedAt === null))
    .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())
    .map(toDesignMeta)
}

export function getLocalDesign(id: string): StoredLocalDesign | null {
  const all = readAll()
  return all.find((d) => d.id === id) ?? null
}

export function createLocalDesign(opts: {
  name: string
  width: number
  height: number
  pages: PageData[]
  source?: string
  thumbnail?: string | null
}): StoredLocalDesign {
  const now = new Date().toISOString()
  const record: StoredLocalDesign = {
    id: `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: opts.name.trim() || 'Untitled design',
    width: Math.round(opts.width) || 1080,
    height: Math.round(opts.height) || 1080,
    pages: opts.pages,
    thumbnail: opts.thumbnail ?? null,
    source: opts.source ?? 'blank',
    ownerId: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  const all = readAll()
  writeAll([record, ...all])
  return record
}

export function saveLocalDesign(
  id: string,
  patch: {
    name?: string
    width?: number
    height?: number
    pages?: PageData[]
    thumbnail?: string | null
  }
): StoredLocalDesign | null {
  const all = readAll()
  const idx = all.findIndex((d) => d.id === id)
  const now = new Date().toISOString()
  if (idx === -1) {
    if (!patch.pages) return null
    const created: StoredLocalDesign = {
      id,
      name: patch.name?.trim() || 'Untitled design',
      width: patch.width ?? 1080,
      height: patch.height ?? 1080,
      pages: patch.pages,
      thumbnail: patch.thumbnail ?? null,
      source: 'local',
      ownerId: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    writeAll([created, ...all])
    return created
  }
  const current = all[idx]
  const updated: StoredLocalDesign = {
    ...current,
    ...(typeof patch.name === 'string' && patch.name.trim() ? { name: patch.name.trim() } : {}),
    ...(typeof patch.width === 'number' ? { width: patch.width } : {}),
    ...(typeof patch.height === 'number' ? { height: patch.height } : {}),
    ...(patch.pages !== undefined ? { pages: patch.pages } : {}),
    ...(patch.thumbnail !== undefined ? { thumbnail: patch.thumbnail } : {}),
    updatedAt: now,
  }
  const next = [...all]
  next[idx] = updated
  writeAll(next)
  return updated
}

export function deleteLocalDesign(id: string, permanent = false): boolean {
  const all = readAll()
  const idx = all.findIndex((d) => d.id === id)
  if (idx === -1) return false
  if (permanent) {
    writeAll(all.filter((d) => d.id !== id))
    return true
  }
  const next = [...all]
  next[idx] = { ...next[idx], deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  writeAll(next)
  return true
}

export function restoreLocalDesign(id: string): boolean {
  const all = readAll()
  const idx = all.findIndex((d) => d.id === id)
  if (idx === -1) return false
  const next = [...all]
  next[idx] = { ...next[idx], deletedAt: null, updatedAt: new Date().toISOString() }
  writeAll(next)
  return true
}

