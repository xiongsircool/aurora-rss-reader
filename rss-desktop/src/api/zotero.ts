import api from './client'

export interface ZoteroStatus {
  running: boolean
}

export interface ZoteroSaveResult {
  success: boolean
  message: string
}

export async function getZoteroStatus(): Promise<ZoteroStatus> {
  const { data } = await api.get<ZoteroStatus>('/zotero/status')
  return data
}

export async function saveToZotero(params: {
  url: string
  title: string
  author?: string | null
  summary?: string | null
  publishedAt?: string | null
  feedTitle?: string | null
  doi?: string | null
}): Promise<ZoteroSaveResult> {
  const { data } = await api.post<ZoteroSaveResult>('/zotero/save', params)
  return data
}
