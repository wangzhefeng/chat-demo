import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acceptAiEdit,
  cancelAiEdit,
  rejectAiEdit,
  startAiEdit,
  useAiEditStore,
} from '../src/services/reports/aiEdit.js'
import { diffLines } from '../src/services/reports/diff.js'
import * as db from '../src/services/reports/db.js'
import {
  createOrOpenReport,
  restoreReportVersion,
  saveActiveReport,
  updateReportContent,
  useReportStore,
} from '../src/services/reports/store.js'
import { rewriteSelection } from '../src/services/reports/rewrite.js'
import { makeReply, makeSession } from './reportFixtures.js'

vi.mock('../src/services/reports/rewrite.js', () => ({ rewriteSelection: vi.fn() }))

let sequence = 0
const setupReport = async () => {
  sequence += 1
  const reply = makeReply(`ai-reply-${sequence}`)
  const session = makeSession(`ai-session-${sequence}`, reply)
  await createOrOpenReport(session, reply)
  updateReportContent('Before original selection after')
  await saveActiveReport()
  const content = useReportStore.getState().draft?.content ?? ''
  return { start: 7, end: 25, content }
}

beforeEach(() => {
  vi.clearAllMocks()
  useAiEditStore.setState({ status: 'idle', suggestion: null, error: null })
  useReportStore.setState({
    ready: true,
    loadError: false,
    reports: [],
    isOpen: true,
    activeId: null,
    draft: null,
    saveStatus: 'saved',
    pending: false,
    versions: [],
  })
})

describe('AI report edits', () => {
  it('accepts a suggestion only after review and saves a version', async () => {
    const { start, end, content } = await setupReport()
    vi.mocked(rewriteSelection).mockResolvedValue('improved text')

    expect(await startAiEdit('Simplify', start, end)).toBe(true)
    expect(useAiEditStore.getState().status).toBe('ready')
    expect(useReportStore.getState().draft?.content).toBe(content)
    expect(rewriteSelection).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'original selection',
      'Simplify',
      expect.any(AbortSignal),
      expect.any(Function)
    )

    expect(await acceptAiEdit()).toBe(true)
    expect(useReportStore.getState().draft?.content).toBe('Before improved text after')
    const versions = await db.loadReportVersions(useReportStore.getState().activeId ?? '')
    expect(versions).toHaveLength(1)
    expect(versions[0]).toMatchObject({ content, reason: 'ai-edit' })

    expect(await restoreReportVersion(versions[0])).toBe(true)
    expect(useReportStore.getState().draft?.content).toBe(content)
    const afterRestore = await db.loadReportVersions(useReportStore.getState().activeId ?? '')
    expect(afterRestore).toHaveLength(2)
    expect(afterRestore[0]?.reason).toBe('restore')
    expect(afterRestore[0]?.content).toBe('Before improved text after')
  })

  it('rejects a suggestion without changing content or creating a version', async () => {
    const { start, end, content } = await setupReport()
    vi.mocked(rewriteSelection).mockResolvedValue('rejected text')
    await startAiEdit('Rewrite', start, end)
    rejectAiEdit()

    expect(useAiEditStore.getState().status).toBe('idle')
    expect(useReportStore.getState().draft?.content).toBe(content)
    expect(await db.loadReportVersions(useReportStore.getState().activeId ?? '')).toHaveLength(0)
  })

  it('marks a suggestion stale when the user edits the selected text', async () => {
    const { start, end, content } = await setupReport()
    let resolve: ((text: string) => void) | undefined
    vi.mocked(rewriteSelection).mockReturnValue(
      new Promise<string>((resolvePromise) => {
        resolve = resolvePromise
      })
    )
    const task = startAiEdit('Rewrite', start, end)
    await vi.waitFor(() => expect(useAiEditStore.getState().status).toBe('streaming'))
    updateReportContent(`Changed ${content}`)
    expect(useAiEditStore.getState().status).toBe('stale')
    resolve?.('late result')
    expect(await task).toBe(false)
    expect(useAiEditStore.getState().status).toBe('stale')
    expect(await acceptAiEdit()).toBe(false)
    expect(useReportStore.getState().draft?.content).toBe(`Changed ${content}`)
  })

  it('keeps the report unchanged on cancellation or failure', async () => {
    const { start, end, content } = await setupReport()
    vi.mocked(rewriteSelection).mockImplementation(
      (_key, _title, _selection, _instruction, signal) =>
        new Promise<string>((_resolve, reject) => {
          signal.addEventListener('abort', () =>
            reject(new DOMException('Cancelled', 'AbortError'))
          )
        })
    )
    const task = startAiEdit('Rewrite', start, end)
    await vi.waitFor(() => expect(useAiEditStore.getState().status).toBe('streaming'))
    cancelAiEdit()
    expect(await task).toBe(false)
    expect(useReportStore.getState().draft?.content).toBe(content)

    vi.mocked(rewriteSelection).mockRejectedValueOnce(new Error('network failed'))
    expect(await startAiEdit('Rewrite', start, end)).toBe(false)
    expect(useAiEditStore.getState().status).toBe('error')
    expect(useReportStore.getState().draft?.content).toBe(content)
  })
})

describe('line differences', () => {
  it('shows unchanged, removed and added lines', () => {
    expect(diffLines('same\nold\nend', 'same\nnew\nend')).toEqual([
      { type: 'same', text: 'same' },
      { type: 'removed', text: 'old' },
      { type: 'added', text: 'new' },
      { type: 'same', text: 'end' },
    ])
  })
})
