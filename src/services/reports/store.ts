import { create } from 'zustand'
import type { AssistantMessage, Session } from '../chat/types.js'
import * as db from './db.js'
import { createReportSnapshot, reportSourceKey } from './report.js'
import type { Report, ReportSaveStatus } from './types.js'

type ReportState = {
  ready: boolean
  loadError: boolean
  reports: Report[]
  isOpen: boolean
  activeId: string | null
  draft: Report | null
  saveStatus: ReportSaveStatus
  pending: boolean
}

export const useReportStore = create<ReportState>(() => ({
  ready: false,
  loadError: false,
  reports: [],
  isOpen: false,
  activeId: null,
  draft: null,
  saveStatus: 'saved',
  pending: false,
}))

const { getState: get, setState: set } = useReportStore
let initTask: Promise<void> | undefined
let openSequence = 0
let autosaveTimer: ReturnType<typeof setTimeout> | undefined
let saveQueue: Promise<unknown> = Promise.resolve()

const sortReports = (reports: Report[]) => [...reports].sort((a, b) => b.updatedAt - a.updatedAt)

const replaceReport = (report: Report) =>
  set((state) => ({
    reports: sortReports([...state.reports.filter((item) => item.id !== report.id), report]),
  }))

const activate = (report: Report) => {
  set({
    activeId: report.id,
    draft: { ...report },
    saveStatus: 'saved',
    pending: false,
    loadError: false,
  })
}

export const initReports = (force = false): Promise<void> => {
  if (get().ready && !get().loadError && !force) {
    return Promise.resolve()
  }
  if (initTask) {
    return initTask
  }
  set({ loadError: false })
  initTask = (async () => {
    try {
      const reports = await db.loadReports()
      set({ reports, ready: true, loadError: false })
    } catch {
      set({ loadError: true })
    } finally {
      initTask = undefined
    }
  })()
  return initTask
}

export const openReports = () => {
  set({ isOpen: true })
  void initReports(true)
}

export const saveActiveReport = (): Promise<boolean> => {
  clearTimeout(autosaveTimer)
  autosaveTimer = undefined
  const run = saveQueue.then(async () => {
    const draft = get().draft
    const status = get().saveStatus
    if (!draft || status === 'saved') {
      return status === 'saved'
    }
    if (status === 'conflict') {
      return false
    }
    const snapshot = draft
    set({ saveStatus: 'saving' })
    try {
      const saved = await db.saveReport(
        snapshot.id,
        snapshot.title,
        snapshot.content,
        snapshot.revision
      )
      replaceReport(saved)
      const current = get().draft
      if (current?.id === saved.id) {
        if (current.title === snapshot.title && current.content === snapshot.content) {
          set({ draft: { ...saved }, saveStatus: 'saved' })
        } else {
          set({
            draft: { ...current, revision: saved.revision, updatedAt: saved.updatedAt },
            saveStatus: 'dirty',
          })
        }
      }
      return true
    } catch (error) {
      if (get().draft?.id === snapshot.id) {
        set({ saveStatus: error instanceof db.ReportConflictError ? 'conflict' : 'error' })
      }
      return false
    }
  })
  saveQueue = run.catch(() => {})
  return run
}

const flushActiveReport = async (): Promise<boolean> => {
  const saved = await saveActiveReport()
  if (saved && get().saveStatus === 'dirty') {
    return saveActiveReport()
  }
  return saved && get().saveStatus === 'saved'
}

const scheduleSave = () => {
  clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => {
    void saveActiveReport()
  }, 400)
}

const updateDraft = (update: (draft: Report) => Report) => {
  const draft = get().draft
  if (!draft || get().saveStatus === 'conflict') {
    return
  }
  set({ draft: update(draft), saveStatus: 'dirty' })
  scheduleSave()
}

export const updateReportTitle = (title: string) => updateDraft((draft) => ({ ...draft, title }))

export const updateReportContent = (content: string) =>
  updateDraft((draft) => ({ ...draft, content }))

export const openReport = async (id: string): Promise<boolean> => {
  const sequence = ++openSequence
  set({ isOpen: true, pending: true })
  if (!(await flushActiveReport())) {
    if (sequence === openSequence) {
      set({ pending: false })
    }
    return false
  }
  try {
    const report = await db.loadReport(id)
    if (!report) {
      throw new Error(`Report ${id} is missing from local storage`)
    }
    if (sequence === openSequence) {
      activate(report)
    }
    return true
  } catch {
    if (sequence === openSequence) {
      set({ pending: false, loadError: true })
    }
    return false
  }
}

export const openReportList = async (): Promise<boolean> => {
  const sequence = ++openSequence
  set({ isOpen: true, pending: true })
  if (!(await flushActiveReport())) {
    if (sequence === openSequence) {
      set({ pending: false })
    }
    return false
  }
  if (sequence === openSequence) {
    set({ activeId: null, draft: null, saveStatus: 'saved', pending: false })
  }
  await initReports(true)
  return true
}

export const createOrOpenReport = async (
  session: Session,
  message: AssistantMessage
): Promise<boolean> => {
  const sequence = ++openSequence
  set({ isOpen: true, pending: true })
  if (!(await flushActiveReport())) {
    if (sequence === openSequence) {
      set({ pending: false })
    }
    return false
  }
  try {
    const sourceKey = reportSourceKey(session.id, message.id)
    const existing = await db.loadReportBySource(sourceKey)
    const snapshot = existing ?? createReportSnapshot(session, message)
    if (!snapshot) {
      throw new Error('The answer has no reportable content')
    }
    const report = await db.createReport(snapshot)
    replaceReport(report)
    if (sequence === openSequence) {
      activate(report)
    }
    return true
  } catch {
    if (sequence === openSequence) {
      set({ pending: false, loadError: true })
    }
    return false
  }
}

export const reloadActiveReport = async (): Promise<boolean> => {
  const id = get().activeId
  if (!id) {
    return false
  }
  try {
    const report = await db.loadReport(id)
    if (!report) {
      throw new Error(`Report ${id} is missing from local storage`)
    }
    replaceReport(report)
    activate(report)
    return true
  } catch {
    set({ loadError: true })
    return false
  }
}

export const closeReportPanel = () => {
  if (get().saveStatus === 'dirty' || get().saveStatus === 'error') {
    void saveActiveReport()
  }
  set({ isOpen: false })
}

export const bindReportPersistence = () => {
  const save = () => {
    if (get().saveStatus === 'dirty' || get().saveStatus === 'error') {
      void saveActiveReport()
    }
  }
  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      save()
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', save)
  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('pagehide', save)
  }
}
