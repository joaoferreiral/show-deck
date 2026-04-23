import Dexie, { type Table } from 'dexie'
import type { Show, Artist, Contractor, LocalPartner, Receivable } from '@/types'

export interface SyncQueueItem {
  id?: number
  table: string
  action: 'insert' | 'update' | 'delete'
  payload: Record<string, unknown>
  createdAt: Date
  retries: number
}

export interface CachedShow extends Show {
  _synced?: boolean
}

class ShowDeckDB extends Dexie {
  shows!: Table<CachedShow>
  artists!: Table<Artist>
  contractors!: Table<Contractor>
  localPartners!: Table<LocalPartner>
  receivables!: Table<Receivable>
  syncQueue!: Table<SyncQueueItem>

  constructor() {
    super('showdeck')
    this.version(1).stores({
      shows: 'id, org_id, artist_id, start_at, status, updated_at',
      artists: 'id, org_id, name, active',
      contractors: 'id, org_id, name',
      localPartners: 'id, org_id, name',
      receivables: 'id, show_id, org_id, due_date, status',
      syncQueue: '++id, table, action, createdAt',
    })
  }
}

export const db = new ShowDeckDB()

export async function cacheShows(shows: CachedShow[]) {
  await db.shows.bulkPut(shows)
}

export async function cacheArtists(artists: Artist[]) {
  await db.artists.bulkPut(artists)
}

export async function getOfflineShows(orgId: string) {
  return db.shows.where('org_id').equals(orgId).toArray()
}

export async function enqueueMutation(item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'retries'>) {
  await db.syncQueue.add({ ...item, createdAt: new Date(), retries: 0 })
}

export async function getPendingMutations() {
  return db.syncQueue.orderBy('createdAt').toArray()
}

export async function removeMutation(id: number) {
  await db.syncQueue.delete(id)
}
