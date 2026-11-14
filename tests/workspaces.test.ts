import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import * as chatDb from '../src/services/chat/db.js'
import { toRequestMessages } from '../src/services/chat/reply.js'
import type { UserMessage } from '../src/services/chat/types.js'
import { createReportSnapshot } from '../src/services/reports/report.js'
import * as reportDb from '../src/services/reports/db.js'
import {
  addNoteFromMessage,
  addWorkspaceMaterial,
  createWorkspace,
  getRequestContextSnapshot,
  initWorkspaces,
  removeMaterial,
  removeNote,
  removeWorkspace,
  searchWorkspace,
  setSessionFavorite,
  setSessionTags,
  toggleContextItem,
  toggleWorkspaceReport,
  toggleWorkspaceSession,
  useWorkspaceStore,
} from '../src/services/workspaces/store.js'
import { makeReply, makeSession } from './reportFixtures.js'

const setupWorkspace = async () => {
  const suffix = crypto.randomUUID()
  const reply = makeReply(`workspace-reply-${suffix}`)
  const session = makeSession(`workspace-session-${suffix}`, reply)
  await chatDb.saveSession(session)
  const report = createReportSnapshot(session, reply)
  if (!report) {
    throw new Error('Expected report fixture')
  }
  await reportDb.createReport(report)
  const workspaceId = await createWorkspace(`Workspace ${suffix}`, 'Long-term research')
  await toggleWorkspaceSession(workspaceId, session.id)
  await toggleWorkspaceReport(workspaceId, report.id)
  await addNoteFromMessage(workspaceId, session, reply, 'Selected evidence')
  await addWorkspaceMaterial(workspaceId, 'https://example.com/material')
  return { workspaceId, session, reply, report }
}

beforeEach(() => {
  useWorkspaceStore.setState({
    ready: true,
    loadError: false,
    contextPending: false,
    isOpen: true,
    activeId: null,
    workspaces: [],
    notes: [],
    sessionMetadata: [],
    contextCache: {},
  })
})

describe('topic workspaces', () => {
  it('associates content without selecting it for requests by default', async () => {
    const { workspaceId, session } = await setupWorkspace()
    const workspace = useWorkspaceStore
      .getState()
      .workspaces.find((item) => item.id === workspaceId)
    expect(workspace?.sessionIds).toContain(session.id)
    expect(workspace?.reportIds).toHaveLength(1)
    expect(workspace?.materials).toHaveLength(1)
    expect(useWorkspaceStore.getState().notes).toHaveLength(1)
    expect(getRequestContextSnapshot(session.id)).toBeUndefined()
  })

  it('includes only explicitly selected items and restores selections after reload', async () => {
    const { workspaceId, session, report } = await setupWorkspace()
    const note = useWorkspaceStore.getState().notes[0]
    const material = useWorkspaceStore.getState().workspaces.find((item) => item.id === workspaceId)
      ?.materials[0]
    if (!note || !material) {
      throw new Error('Expected note and material fixtures')
    }
    await toggleContextItem(workspaceId, 'noteIds', note.id)
    await toggleContextItem(workspaceId, 'materialIds', material.id)

    const snapshot = getRequestContextSnapshot(session.id)
    expect(snapshot?.items.map((item) => item.type)).toEqual(['note', 'material'])
    expect(snapshot?.text).toContain('Selected evidence')
    expect(snapshot?.text).toContain('https://example.com/material')
    expect(snapshot?.text).not.toContain(report.content)

    useWorkspaceStore.setState({
      ready: false,
      workspaces: [],
      notes: [],
      sessionMetadata: [],
      contextCache: {},
    })
    await initWorkspaces()
    const restored = getRequestContextSnapshot(session.id)
    expect(restored?.items.map((item) => item.id)).toEqual([note.id, material.id])
  })

  it('searches full text across associated sessions, notes, reports and materials', async () => {
    const { workspaceId } = await setupWorkspace()
    expect(
      (await searchWorkspace(workspaceId, 'Markdown')).some((item) => item.type === 'session')
    ).toBe(true)
    expect(
      (await searchWorkspace(workspaceId, 'Selected evidence')).some((item) => item.type === 'note')
    ).toBe(true)
    expect(
      (await searchWorkspace(workspaceId, 'example.com/material')).some(
        (item) => item.type === 'material'
      )
    ).toBe(true)
    expect(await searchWorkspace(workspaceId, 'not-present-anywhere')).toEqual([])
  })

  it('persists favorites and tags independently of chat data', async () => {
    const { session } = await setupWorkspace()
    await setSessionFavorite(session.id, true)
    await setSessionTags(session.id, [' research ', 'database', 'research'])
    expect(useWorkspaceStore.getState().sessionMetadata[0]).toEqual({
      sessionId: session.id,
      favorite: true,
      tags: ['research', 'database'],
    })
  })

  it('cleans notes, materials and context while preserving source chats and reports', async () => {
    const { workspaceId, session, report } = await setupWorkspace()
    const note = useWorkspaceStore.getState().notes[0]
    const workspace = useWorkspaceStore
      .getState()
      .workspaces.find((item) => item.id === workspaceId)
    const material = workspace?.materials[0]
    if (!note || !material) {
      throw new Error('Expected workspace fixtures')
    }
    await toggleContextItem(workspaceId, 'noteIds', note.id)
    await toggleContextItem(workspaceId, 'materialIds', material.id)
    await removeNote(workspaceId, note.id)
    await removeMaterial(workspaceId, material.id)
    const updated = useWorkspaceStore.getState().workspaces.find((item) => item.id === workspaceId)
    expect(updated?.context.noteIds).toEqual([])
    expect(updated?.context.materialIds).toEqual([])
    expect(updated?.materials).toEqual([])

    await removeWorkspace(workspaceId)
    expect(useWorkspaceStore.getState().workspaces.some((item) => item.id === workspaceId)).toBe(
      false
    )
    expect(await chatDb.loadSession(session.id)).not.toBeUndefined()
    expect(await reportDb.loadReport(report.id)).not.toBeUndefined()
  })
})

describe('workspace request context', () => {
  it('prepends only the selected context without mutating the stored question', () => {
    const question: UserMessage = {
      id: 'question',
      role: 'user',
      content: 'Current question',
      files: [],
      createdAt: 1,
    }
    const messages = toRequestMessages(
      [],
      question,
      undefined,
      false,
      undefined,
      'Selected note text'
    )
    expect(messages[0]?.content).toBe('Selected note text\n\nCurrent question')
    expect(question.content).toBe('Current question')
    expect(toRequestMessages([], question)[0]?.content).toBe('Current question')
  })
})
