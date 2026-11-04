import { describe, it, expect, beforeEach } from 'vitest'
import {
  createLocalDesign,
  deleteLocalDesign,
  getLocalDesign,
  isLocalDesignId,
  listLocalDesigns,
  restoreLocalDesign,
  saveLocalDesign,
} from './local-designs'
import { createPage } from './types'

// Minimal in-memory localStorage shim for Node Vitest environment
const store = new Map<string, string>()
const localStorageMock = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v) },
  removeItem: (k: string) => { store.delete(k) },
  clear: () => { store.clear() },
}

beforeEach(() => {
  store.clear()
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage: localStorageMock },
    writable: true,
    configurable: true,
  })
})

describe('local-designs fallback store', () => {
  it('creates, lists, updates, trashes, restores, and permanently deletes local designs', () => {
    const page = createPage()
    const created = createLocalDesign({
      name: 'Instagram Sale Template',
      width: 1080,
      height: 1080,
      pages: [page],
      source: 'template:instagram-sale',
    })

    expect(isLocalDesignId(created.id)).toBe(true)
    expect(getLocalDesign(created.id)?.name).toBe('Instagram Sale Template')
    expect(listLocalDesigns(false)).toHaveLength(1)

    // Update name and pages
    const updated = saveLocalDesign(created.id, { name: 'Renamed Template' })
    expect(updated?.name).toBe('Renamed Template')
    expect(getLocalDesign(created.id)?.name).toBe('Renamed Template')

    // Soft delete to trash
    expect(deleteLocalDesign(created.id, false)).toBe(true)
    expect(listLocalDesigns(false)).toHaveLength(0)
    expect(listLocalDesigns(true)).toHaveLength(1)

    // Restore from trash
    expect(restoreLocalDesign(created.id)).toBe(true)
    expect(listLocalDesigns(false)).toHaveLength(1)
    expect(listLocalDesigns(true)).toHaveLength(0)

    // Permanent delete
    expect(deleteLocalDesign(created.id, true)).toBe(true)
    expect(listLocalDesigns(false)).toHaveLength(0)
    expect(getLocalDesign(created.id)).toBeNull()
  })
})

