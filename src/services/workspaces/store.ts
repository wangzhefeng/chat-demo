import { create } from 'zustand'
import { translate } from '../../i18n/index.js'
import { createId } from '../../utils/id.js'
import { getVisibleMessages } from '../chat/branches.js'
import * as chatDb from '../chat/db.js'
import { getReplyText } from '../chat/reply.js'
import type { Message, Session } from '../chat/types.js'
import * as reportDb from '../reports/db.js'
import * as db from './db.js'
import type {
  RequestContextSnapshot,
  SessionMetadata,
  Workspace,
  WorkspaceContextItem,
  WorkspaceNote,
  WorkspaceSearchResult,
} from './types.js'

type ContextCache = Record<string, WorkspaceContextItem & { text: string }>

type WorkspaceState = {
  ready: boolean
  loadError: boolean
  contextPending: boolean
  isOpen: boolean
  activeId: string | null
  workspaces: Workspace[]
  notes: WorkspaceNote[]
  sessionMetadata: SessionMetadata[]
  contextCache: ContextCache
}

export const useWorkspaceStore = create<WorkspaceState>(() => ({
  ready: false,
  loadError: false,
  contextPending: false,
  isOpen: false,
  activeId: null,
  workspaces: [],
  notes: [],
  sessionMetadata: [],
  contextCache: {},
}))

const { getState: get, setState: set } = useWorkspaceStore
let initTask: Promise<void> | undefined
let cacheSequence = 0
let syncChannel: BroadcastChannel | undefined

const notifyWorkspaceChange = () => syncChannel?.postMessage({ type: 'changed' })

export const bindWorkspaceSync = () => {
  if (typeof BroadcastChannel !== 'undefined' && !syncChannel) {
    syncChannel = new BroadcastChannel('chat-demo-workspaces-sync')
    syncChannel.onmessage = () => {
      void (async () => {
        const [workspaces, notes, sessionMetadata] = await Promise.all([
          db.loadWorkspaces(),
          db.loadNotes(),
          db.loadSessionMetadata(),
        ])
        set({ workspaces, notes, sessionMetadata })
        await rebuildContextCache(workspaces, notes)
      })()
    }
  }
  return () => {
    syncChannel?.close()
    syncChannel = undefined
  }
}

const sessionText = (session: Session) =>
  getVisibleMessages(session)
    .map((message) =>
      message.role === 'user'
        ? `${translate('contextUserMessage')}: ${message.content}`
        : `${translate('contextAssistantMessage')}: ${getReplyText(message)}`
    )
    .join('\n\n')

const selectedEntries = (workspaces: Workspace[]) => {
  const sessionIds = new Set<string>()
  const noteIds = new Set<string>()
  const reportIds = new Set<string>()
  for (const workspace of workspaces) {
    workspace.context.sessionIds.forEach((id) => sessionIds.add(id))
    workspace.context.noteIds.forEach((id) => noteIds.add(id))
    workspace.context.reportIds.forEach((id) => reportIds.add(id))
  }
  return { sessionIds, noteIds, reportIds }
}

const rebuildContextCache = async (workspaces: Workspace[], notes: WorkspaceNote[]) => {
  const sequence = ++cacheSequence
  const selected = selectedEntries(workspaces)
  const reports = await reportDb.loadReports()
  const sessions = await Promise.all([...selected.sessionIds].map((id) => chatDb.loadSession(id)))
  const cache: ContextCache = {}
  for (const workspace of workspaces) {
    for (const id of workspace.context.sessionIds) {
      const session = sessions.find((item) => item?.id === id)
      if (session) {
        cache[`session:${id}`] = {
          id,
          type: 'session',
          title: session.title || translate('untitledChat'),
          text: sessionText(session),
        }
      }
    }
    for (const id of workspace.context.noteIds) {
      const note = notes.find((item) => item.id === id)
      if (note) {
        cache[`note:${id}`] = { id, type: 'note', title: note.title, text: note.content }
      }
    }
    for (const id of workspace.context.reportIds) {
      const report = reports.find((item) => item.id === id)
      if (report) {
        cache[`report:${id}`] = {
          id,
          type: 'report',
          title: report.title,
          text: report.content,
        }
      }
    }
    for (const material of workspace.materials) {
      if (workspace.context.materialIds.includes(material.id)) {
        cache[`material:${material.id}`] = {
          id: material.id,
          type: 'material',
          title: material.title,
          text: material.url,
        }
      }
    }
  }
  if (sequence === cacheSequence) {
    set({ contextCache: cache })
  }
}

export const initWorkspaces = (): Promise<void> => {
  if (get().ready) {
    return Promise.resolve()
  }
  if (initTask) {
    return initTask
  }
  initTask = (async () => {
    try {
      const [workspaces, notes, sessionMetadata] = await Promise.all([
        db.loadWorkspaces(),
        db.loadNotes(),
        db.loadSessionMetadata(),
      ])
      set({ workspaces, notes, sessionMetadata, loadError: false })
      await rebuildContextCache(workspaces, notes)
      set({ ready: true })
    } catch {
      set({ loadError: true, ready: true })
    } finally {
      initTask = undefined
    }
  })()
  return initTask
}

export const openWorkspaces = () => {
  set({ isOpen: true })
  void initWorkspaces()
}

export const closeWorkspaces = () => set({ isOpen: false })

export const showWorkspaceList = () => set({ activeId: null })

export const createWorkspace = async (name: string, description: string): Promise<string> => {
  const now = Date.now()
  const workspace: Workspace = {
    id: createId(),
    name: name.trim() || translate('untitledWorkspace'),
    description: description.trim(),
    sessionIds: [],
    reportIds: [],
    materials: [],
    context: { sessionIds: [], noteIds: [], reportIds: [], materialIds: [] },
    createdAt: now,
    updatedAt: now,
  }
  await db.saveWorkspace(workspace)
  set((state) => ({ workspaces: [...state.workspaces, workspace], activeId: workspace.id }))
  notifyWorkspaceChange()
  return workspace.id
}

export const updateWorkspace = async (
  id: string,
  update: (workspace: Workspace) => Workspace
): Promise<boolean> => {
  const current = get().workspaces.find((workspace) => workspace.id === id)
  if (!current) {
    return false
  }
  const workspace = { ...update(current), updatedAt: Date.now() }
  set({ contextPending: true })
  try {
    await db.saveWorkspace(workspace)
    const workspaces = get().workspaces.map((item) => (item.id === id ? workspace : item))
    set({ workspaces, loadError: false })
    await rebuildContextCache(workspaces, get().notes)
    notifyWorkspaceChange()
    return true
  } catch {
    set({ loadError: true })
    return false
  } finally {
    set({ contextPending: false })
  }
}

const toggleId = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]

export const toggleWorkspaceSession = (workspaceId: string, sessionId: string) =>
  updateWorkspace(workspaceId, (workspace) => ({
    ...workspace,
    sessionIds: toggleId(workspace.sessionIds, sessionId),
    context: {
      ...workspace.context,
      sessionIds: workspace.context.sessionIds.filter((id) => id !== sessionId),
    },
  }))

export const toggleWorkspaceReport = (workspaceId: string, reportId: string) =>
  updateWorkspace(workspaceId, (workspace) => ({
    ...workspace,
    reportIds: toggleId(workspace.reportIds, reportId),
    context: {
      ...workspace.context,
      reportIds: workspace.context.reportIds.filter((id) => id !== reportId),
    },
  }))

export const toggleContextItem = (
  workspaceId: string,
  type: keyof Workspace['context'],
  id: string
) =>
  updateWorkspace(workspaceId, (workspace) => ({
    ...workspace,
    context: { ...workspace.context, [type]: toggleId(workspace.context[type], id) },
  }))

export const addWorkspaceMaterial = async (workspaceId: string, url: string) => {
  const now = Date.now()
  return updateWorkspace(workspaceId, (workspace) => ({
    ...workspace,
    materials: [...workspace.materials, { id: createId(), url, title: url, createdAt: now }],
  }))
}

export const setSessionFavorite = async (sessionId: string, favorite: boolean) => {
  const current = get().sessionMetadata.find((item) => item.sessionId === sessionId)
  const metadata = current ?? { sessionId, tags: [], favorite: false }
  const next = { ...metadata, favorite }
  await db.saveSessionMetadata(next)
  set((state) => ({
    sessionMetadata: [
      ...state.sessionMetadata.filter((item) => item.sessionId !== sessionId),
      next,
    ],
  }))
  notifyWorkspaceChange()
}

export const setSessionTags = async (sessionId: string, tags: string[]) => {
  const current = get().sessionMetadata.find((item) => item.sessionId === sessionId)
  const metadata = current ?? { sessionId, favorite: false, tags: [] }
  const next = { ...metadata, tags: [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))] }
  await db.saveSessionMetadata(next)
  set((state) => ({
    sessionMetadata: [
      ...state.sessionMetadata.filter((item) => item.sessionId !== sessionId),
      next,
    ],
  }))
  notifyWorkspaceChange()
}

export const addNoteFromMessage = async (
  workspaceId: string,
  session: Session,
  message: Message,
  title: string
): Promise<boolean> => {
  const content = message.role === 'user' ? message.content : getReplyText(message)
  if (!content) {
    return false
  }
  const now = Date.now()
  const note: WorkspaceNote = {
    id: createId(),
    workspaceId,
    title: title.trim() || translate('untitledNote'),
    content,
    source: { sessionId: session.id, messageId: message.id },
    createdAt: now,
    updatedAt: now,
  }
  try {
    await db.saveNote(note)
    set((state) => ({ notes: [...state.notes, note] }))
    return updateWorkspace(workspaceId, (workspace) => ({
      ...workspace,
      sessionIds: workspace.sessionIds.includes(session.id)
        ? workspace.sessionIds
        : [...workspace.sessionIds, session.id],
    }))
  } catch {
    set({ loadError: true })
    return false
  }
}

export const removeWorkspace = async (id: string): Promise<boolean> => {
  try {
    await db.deleteWorkspace(id)
    set((state) => ({
      workspaces: state.workspaces.filter((workspace) => workspace.id !== id),
      notes: state.notes.filter((note) => note.workspaceId !== id),
      activeId: state.activeId === id ? null : state.activeId,
    }))
    await rebuildContextCache(get().workspaces, get().notes)
    notifyWorkspaceChange()
    return true
  } catch {
    set({ loadError: true })
    return false
  }
}

export const removeNote = async (workspaceId: string, noteId: string) => {
  await db.deleteNote(noteId)
  set((state) => ({ notes: state.notes.filter((note) => note.id !== noteId) }))
  return updateWorkspace(workspaceId, (workspace) => ({
    ...workspace,
    context: {
      ...workspace.context,
      noteIds: workspace.context.noteIds.filter((id) => id !== noteId),
    },
  }))
}

export const removeMaterial = (workspaceId: string, materialId: string) =>
  updateWorkspace(workspaceId, (workspace) => ({
    ...workspace,
    materials: workspace.materials.filter((material) => material.id !== materialId),
    context: {
      ...workspace.context,
      materialIds: workspace.context.materialIds.filter((id) => id !== materialId),
    },
  }))

export const getRequestContextSnapshot = (
  sessionId: string
): RequestContextSnapshot | undefined => {
  const workspace = get().workspaces.find((item) => item.sessionIds.includes(sessionId))
  if (!workspace) {
    return undefined
  }
  const items: (WorkspaceContextItem & { text: string })[] = []
  for (const [type, ids] of [
    ['session', workspace.context.sessionIds],
    ['note', workspace.context.noteIds],
    ['report', workspace.context.reportIds],
    ['material', workspace.context.materialIds],
  ] as const) {
    for (const id of ids) {
      const item = get().contextCache[`${type}:${id}`]
      if (item) {
        items.push(item)
      }
    }
  }
  if (items.length === 0) {
    return undefined
  }
  const labels = {
    session: translate('contextSession'),
    note: translate('contextNote'),
    report: translate('contextReport'),
    material: translate('contextMaterial'),
  }
  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    items: items.map(({ id, type, title }) => ({ id, type, title })),
    text: `${translate('contextInstruction')} ${workspace.name}\n\n${items
      .map((item) => `## ${labels[item.type]}: ${item.title}\n${item.text}`)
      .join('\n\n')}`,
  }
}

const excerpt = (text: string, query: string) => {
  const index = text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase())
  if (index < 0) {
    return text.slice(0, 160)
  }
  return text.slice(Math.max(0, index - 50), index + query.length + 100)
}

export const searchWorkspace = async (
  workspaceId: string,
  query: string
): Promise<WorkspaceSearchResult[]> => {
  const workspace = get().workspaces.find((item) => item.id === workspaceId)
  const term = query.trim()
  if (!workspace || !term) {
    return []
  }
  const reports = await reportDb.loadReports()
  const sessions = await Promise.all(workspace.sessionIds.map((id) => chatDb.loadSession(id)))
  const candidates: (WorkspaceSearchResult & { text: string })[] = []
  for (const session of sessions) {
    if (session) {
      candidates.push({
        id: session.id,
        type: 'session',
        title: session.title || translate('untitledChat'),
        excerpt: '',
        text: `${session.title}\n${sessionText(session)}`,
      })
    }
  }
  for (const note of get().notes.filter((item) => item.workspaceId === workspaceId)) {
    candidates.push({
      id: note.id,
      type: 'note',
      title: note.title,
      excerpt: '',
      text: `${note.title}\n${note.content}`,
    })
  }
  for (const report of reports.filter((item) => workspace.reportIds.includes(item.id))) {
    candidates.push({
      id: report.id,
      type: 'report',
      title: report.title,
      excerpt: '',
      text: `${report.title}\n${report.content}`,
    })
  }
  for (const material of workspace.materials) {
    candidates.push({
      id: material.id,
      type: 'material',
      title: material.title,
      excerpt: '',
      text: `${material.title}\n${material.url}`,
    })
  }
  return candidates
    .filter((item) => item.text.toLocaleLowerCase().includes(term.toLocaleLowerCase()))
    .map(({ text, ...item }) => ({ ...item, excerpt: excerpt(text, term) }))
}
