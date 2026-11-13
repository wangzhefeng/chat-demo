import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Report } from './types.js'

interface ReportDB extends DBSchema {
  reports: {
    key: string
    value: Report
    indexes: { sourceKey: string }
  }
}

let dbPromise: Promise<IDBPDatabase<ReportDB>> | null = null

const getDB = () =>
  (dbPromise ??= openDB<ReportDB>('chat-demo-reports', 1, {
    upgrade(db) {
      const reports = db.createObjectStore('reports', { keyPath: 'id' })
      reports.createIndex('sourceKey', 'sourceKey', { unique: true })
    },
  }).catch((error: unknown) => {
    dbPromise = null
    throw error
  }))

const sortReports = (reports: Report[]) => reports.sort((a, b) => b.updatedAt - a.updatedAt)

export const loadReports = async (): Promise<Report[]> =>
  sortReports(await (await getDB()).getAll('reports'))

export const loadReport = async (id: string): Promise<Report | undefined> =>
  (await getDB()).get('reports', id)

export const loadReportBySource = async (sourceKey: string): Promise<Report | undefined> =>
  (await getDB()).getFromIndex('reports', 'sourceKey', sourceKey)

export const createReport = async (report: Report): Promise<Report> => {
  const tx = (await getDB()).transaction('reports', 'readwrite')
  const existing = await tx.store.index('sourceKey').get(report.sourceKey)
  if (existing) {
    await tx.done
    return existing
  }
  await tx.store.add(report)
  await tx.done
  return report
}

export class ReportConflictError extends Error {
  constructor(readonly current: Report) {
    super('Report was changed in another tab')
    this.name = 'ReportConflictError'
  }
}

export const saveReport = async (
  id: string,
  title: string,
  content: string,
  expectedRevision: number
): Promise<Report> => {
  const tx = (await getDB()).transaction('reports', 'readwrite')
  const current = await tx.store.get(id)
  if (!current) {
    throw new Error(`Report ${id} is missing from local storage`)
  }
  if (current.revision !== expectedRevision) {
    throw new ReportConflictError(current)
  }
  const saved: Report = {
    ...current,
    title,
    content,
    updatedAt: Date.now(),
    revision: current.revision + 1,
  }
  await tx.store.put(saved)
  await tx.done
  return saved
}
