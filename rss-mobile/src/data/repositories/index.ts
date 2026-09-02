import { initData } from '../index'
import { EntryRepository } from './entryRepo'
import { FeedRepository } from './feedRepo'
import { SettingsRepository } from './settingsRepo'
import { SummaryRepository, TranslationRepository } from './aiRepo'

export { EntryRepository } from './entryRepo'
export { FeedRepository } from './feedRepo'
export { SettingsRepository } from './settingsRepo'
export { SummaryRepository, TranslationRepository } from './aiRepo'
export type { EntriesPage, InboxFilter, ListEntriesOptions } from './entryRepo'

export interface Repositories {
  feeds: FeedRepository
  entries: EntryRepository
  settings: SettingsRepository
  summaries: SummaryRepository
  translations: TranslationRepository
}

let repos: Promise<Repositories> | null = null

/** Lazily open the DB (running migrations) and construct repositories once. */
export function getRepositories(): Promise<Repositories> {
  if (!repos) {
    repos = initData().then((db) => ({
      feeds: new FeedRepository(db),
      entries: new EntryRepository(db),
      settings: new SettingsRepository(db),
      summaries: new SummaryRepository(db),
      translations: new TranslationRepository(db),
    }))
  }
  return repos
}
