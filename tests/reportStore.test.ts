import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as db from '../src/services/reports/db.js'
import {
  createOrOpenReport,
  initReports,
  openReport,
  reloadActiveReport,
  saveActiveReport,
  updateReportContent,
  updateReportTitle,
  useReportStore,
} from '../src/services/reports/store.js'
import { makeReply, makeSession } from './reportFixtures.js'

let sequence = 0
const nextSession = () => {
  sequence += 1
  const reply = makeReply(`reply-${sequence}`)
  return { session: makeSession(`session-${sequence}`, reply), reply }
}

beforeEach(() => {
  useReportStore.setState({
    ready: true,
    loadError: false,
    reports: [],
    isOpen: false,
    activeId: null,
    draft: null,
    saveStatus: 'saved',
    pending: false,
  })
})

describe('report persistence', () => {
  it('saves edits and loads them again after a refresh', async () => {
    const { session, reply } = nextSession()
    await createOrOpenReport(session, reply)
    const id = useReportStore.getState().activeId
    expect(id).not.toBeNull()

    updateReportTitle('Edited report')
    updateReportContent('# Saved content')
    expect(await saveActiveReport()).toBe(true)
    expect(useReportStore.getState().saveStatus).toBe('saved')

    useReportStore.setState({ ready: false, activeId: null, draft: null })
    await initReports()
    expect(await openReport(id ?? '')).toBe(true)
    expect(useReportStore.getState().draft?.title).toBe('Edited report')
    expect(useReportStore.getState().draft?.content).toBe('# Saved content')
  })

  it('reopens the existing report without replacing edited content', async () => {
    const { session, reply } = nextSession()
    await createOrOpenReport(session, reply)
    const id = useReportStore.getState().activeId
    updateReportContent('User edited report')
    await saveActiveReport()

    reply.blocks.push({ type: 'text', text: 'Regenerated answer text' })
    await createOrOpenReport(session, reply)

    expect(useReportStore.getState().activeId).toBe(id)
    expect(useReportStore.getState().draft?.content).toBe('User edited report')
  })

  it('keeps local edits when another tab saves a newer revision', async () => {
    const { session, reply } = nextSession()
    await createOrOpenReport(session, reply)
    const id = useReportStore.getState().activeId ?? ''
    await db.saveReport(id, 'Other tab', 'Other tab content', 0)

    updateReportContent('Local unsaved content')
    expect(await saveActiveReport()).toBe(false)
    expect(useReportStore.getState().saveStatus).toBe('conflict')
    expect(useReportStore.getState().draft?.content).toBe('Local unsaved content')

    expect(await reloadActiveReport()).toBe(true)
    expect(useReportStore.getState().draft?.content).toBe('Other tab content')
  })

  it('retains dirty edits after a storage failure', async () => {
    const { session, reply } = nextSession()
    await createOrOpenReport(session, reply)
    const failure = vi.spyOn(db, 'saveReport').mockRejectedValueOnce(new Error('quota exceeded'))

    updateReportContent('Unsaved after failure')
    expect(await saveActiveReport()).toBe(false)
    expect(useReportStore.getState().saveStatus).toBe('error')
    expect(useReportStore.getState().draft?.content).toBe('Unsaved after failure')
    failure.mockRestore()
  })
})
