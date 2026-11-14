import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Report, ReportVersion, ReportVersionReason } from './types.js'

interface ReportDB extends DBSchema {
  reports: {
    key: string
    value: Report
    indexes: { sourceKey: string }
  }
  reportVersions: {
    key: string
    value: ReportVersion
    indexes: { reportId: string }
  }
}

let dbPromise: Promise<IDBPDatabase<ReportDB>> | null = null

const getDB = () =>
  (dbPromise ??= openDB<ReportDB>('chat-demo-reports', 2, {
    upgrade(db, _oldVersion, _newVersion, tx) {
      const reports = db.objectStoreNames.contains('reports')
        ? tx.objectStore('reports')
        : db.createObjectStore('reports', { keyPath: 'id' })
      if (!reports.indexNames.contains('sourceKey')) {
        reports.createIndex('sourceKey', 'sourceKey', { unique: true })
      }
      if (!db.objectStoreNames.contains('reportVersions')) {
        const versions = db.createObjectStore('reportVersions', { keyPath: 'id' })
        versions.createIndex('reportId', 'reportId')
      }
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
  expectedRevision: number,
  version?: { id: string; reason: ReportVersionReason }
): Promise<Report> => {
  const tx = (await getDB()).transaction(['reports', 'reportVersions'], 'readwrite')
  const current = await tx.objectStore('reports').get(id)
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
  if (version) {
    await tx.objectStore('reportVersions').put({
      id: version.id,
      reportId: current.id,
      title: current.title,
      content: current.content,
      revision: current.revision,
      reason: version.reason,
      createdAt: saved.updatedAt,
    })
  }
  await tx.objectStore('reports').put(saved)
  await tx.done
  return saved
}

export const loadAllReportVersions = async (): Promise<ReportVersion[]> =>
  (await getDB()).getAll('reportVersions')

export const replaceReportData = async (
  reports: Report[],
  versions: ReportVersion[]
): Promise<void> => {
  const tx = (await getDB()).transaction(['reports', 'reportVersions'], 'readwrite')
  await tx.objectStore('reports').clear()
  await tx.objectStore('reportVersions').clear()
  for (const report of reports) {
    await tx.objectStore('reports').put(report)
  }
  for (const version of versions) {
    await tx.objectStore('reportVersions').put(version)
  }
  await tx.done
}

export const loadReportVersions = async (reportId: string): Promise<ReportVersion[]> => {
  const versions = await (await getDB()).getAllFromIndex('reportVersions', 'reportId', reportId)
  return versions.sort((a, b) => b.createdAt - a.createdAt)
}
