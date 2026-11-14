import { formatDate } from '../utils/format.js'
import * as chatDb from './chat/db.js'
import { replaceHistory } from './chat/store.js'
import type { Session } from './chat/types.js'
import * as reportDb from './reports/db.js'
import { initReports, useReportStore } from './reports/store.js'
import type { Report, ReportVersion } from './reports/types.js'
import * as workspaceDb from './workspaces/db.js'
import { initWorkspaces, useWorkspaceStore } from './workspaces/store.js'
import type { SessionMetadata, Workspace, WorkspaceNote } from './workspaces/types.js'

export type AppDataBackup = {
  format: 'chat-demo-app-data'
  version: 1
  exportedAt: string
  sessions: Session[]
  reports: Report[]
  reportVersions: ReportVersion[]
  workspaces: Workspace[]
  notes: WorkspaceNote[]
  sessionMetadata: SessionMetadata[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isString = (value: unknown) => typeof value === 'string'
const isNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
const isStringArray = (value: unknown) => Array.isArray(value) && value.every(isString)

const validMessage = (message: unknown) => {
  if (!isRecord(message) || !isString(message.id) || !isNumber(message.createdAt)) {
    return false
  }
  if (message.role === 'user') {
    return isString(message.content) && Array.isArray(message.files)
  }
  return (
    message.role === 'assistant' &&
    Array.isArray(message.blocks) &&
    ['pending', 'streaming', 'done', 'stopped', 'error'].includes(message.status as string)
  )
}

const validSession = (value: unknown) =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.title) &&
  isNumber(value.createdAt) &&
  isNumber(value.updatedAt) &&
  Array.isArray(value.messages) &&
  value.messages.every(validMessage)

const validReport = (value: unknown) =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.sourceKey) &&
  isString(value.title) &&
  isString(value.content) &&
  isRecord(value.source) &&
  isString(value.source.sessionId) &&
  isString(value.source.messageId) &&
  Array.isArray(value.sources) &&
  isNumber(value.createdAt) &&
  isNumber(value.updatedAt) &&
  isNumber(value.revision)

const validVersion = (value: unknown) =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.reportId) &&
  isString(value.title) &&
  isString(value.content) &&
  isNumber(value.revision) &&
  isNumber(value.createdAt) &&
  ['ai-edit', 'restore'].includes(value.reason as string)

const validWorkspace = (value: unknown) =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.name) &&
  isString(value.description) &&
  isStringArray(value.sessionIds) &&
  isStringArray(value.reportIds) &&
  Array.isArray(value.materials) &&
  value.materials.every(
    (material) =>
      isRecord(material) &&
      isString(material.id) &&
      isString(material.url) &&
      isString(material.title) &&
      isNumber(material.createdAt)
  ) &&
  isRecord(value.context) &&
  isStringArray(value.context.sessionIds) &&
  isStringArray(value.context.noteIds) &&
  isStringArray(value.context.reportIds) &&
  isStringArray(value.context.materialIds) &&
  isNumber(value.createdAt) &&
  isNumber(value.updatedAt)

const validNote = (value: unknown) =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.workspaceId) &&
  isString(value.title) &&
  isString(value.content) &&
  isRecord(value.source) &&
  isString(value.source.sessionId) &&
  isString(value.source.messageId) &&
  isNumber(value.createdAt) &&
  isNumber(value.updatedAt)

const validMetadata = (value: unknown) =>
  isRecord(value) &&
  isString(value.sessionId) &&
  typeof value.favorite === 'boolean' &&
  isStringArray(value.tags)

export const readAppDataBackup = (text: string): AppDataBackup => {
  const value: unknown = JSON.parse(text)
  if (
    !isRecord(value) ||
    value.format !== 'chat-demo-app-data' ||
    value.version !== 1 ||
    !isString(value.exportedAt) ||
    !Array.isArray(value.sessions) ||
    !value.sessions.every(validSession) ||
    !Array.isArray(value.reports) ||
    !value.reports.every(validReport) ||
    !Array.isArray(value.reportVersions) ||
    !value.reportVersions.every(validVersion) ||
    !Array.isArray(value.workspaces) ||
    !value.workspaces.every(validWorkspace) ||
    !Array.isArray(value.notes) ||
    !value.notes.every(validNote) ||
    !Array.isArray(value.sessionMetadata) ||
    !value.sessionMetadata.every(validMetadata)
  ) {
    throw new Error('Invalid chat-demo application backup')
  }
  return value as AppDataBackup
}

export const readAppDataSnapshot = async (): Promise<AppDataBackup> => {
  const [sessions, reports, reportVersions, workspaces, notes, sessionMetadata] = await Promise.all(
    [
      chatDb.loadAllSessions(),
      reportDb.loadReports(),
      reportDb.loadAllReportVersions(),
      workspaceDb.loadWorkspaces(),
      workspaceDb.loadNotes(),
      workspaceDb.loadSessionMetadata(),
    ]
  )
  return {
    format: 'chat-demo-app-data',
    version: 1,
    exportedAt: new Date().toISOString(),
    sessions,
    reports,
    reportVersions,
    workspaces,
    notes,
    sessionMetadata,
  }
}

export const exportAppData = async (): Promise<{ name: string; blob: Blob }> => {
  const backup = await readAppDataSnapshot()
  return {
    name: `chat-demo-backup-${formatDate(Date.now())}.json`,
    blob: new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json;charset=utf-8',
    }),
  }
}

const replaceData = async (backup: AppDataBackup) => {
  await replaceHistory(async () => {
    for (const session of backup.sessions) {
      await chatDb.addStagingSession(session)
    }
  })
  await reportDb.replaceReportData(backup.reports, backup.reportVersions)
  await workspaceDb.replaceWorkspaceData(backup.workspaces, backup.notes, backup.sessionMetadata)
}

export const importAppData = async (file: File): Promise<void> => {
  const backup = readAppDataBackup(await file.text())
  const previous = await readAppDataSnapshot()
  try {
    await replaceData(backup)
  } catch (error) {
    await replaceData(previous).catch(() => {})
    throw error
  }
  useReportStore.setState({ ready: false, activeId: null, draft: null, versions: [] })
  useWorkspaceStore.setState({ ready: false, activeId: null, contextCache: {} })
  await Promise.all([initReports(true), initWorkspaces()])
}
