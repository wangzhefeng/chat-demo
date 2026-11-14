import { beforeEach, describe, expect, it, vi } from 'vitest'
import { streamMessage } from '../src/services/api/client.js'
import { rewriteSelection } from '../src/services/reports/rewrite.js'

vi.mock('../src/services/api/client.js', () => ({ streamMessage: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
})

const mockStream = (stopReason: 'end_turn' | 'max_tokens' | 'refusal') => {
  vi.mocked(streamMessage).mockReturnValue(
    (async function* () {
      yield {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      }
      yield {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'Revised **selection**' },
      }
      yield {
        type: 'message_delta',
        delta: { stop_reason: stopReason, stop_sequence: null },
      }
      yield { type: 'message_stop' }
    })()
  )
}

describe('selection rewrite protocol', () => {
  it('uses the existing SSE stream and returns only revised Markdown', async () => {
    mockStream('end_turn')
    const updates: string[] = []
    const result = await rewriteSelection(
      'test-key',
      'Report',
      'Original selection',
      'Improve it',
      new AbortController().signal,
      (text) => updates.push(text)
    )
    expect(result).toBe('Revised **selection**')
    expect(updates.at(-1)).toBe(result)
    expect(streamMessage).toHaveBeenCalledWith(
      'test-key',
      expect.objectContaining({
        model: 'deepseek-flash',
        thinking: { type: 'disabled' },
        tools: [],
      }),
      expect.any(AbortSignal)
    )
    const request = vi.mocked(streamMessage).mock.calls[0]?.[1]
    expect(request?.messages[0]?.content).toContain('Original selection')
    expect(request?.messages[0]?.content).toContain('Improve it')
  })

  it('rejects incomplete output without returning it as a suggestion', async () => {
    mockStream('max_tokens')
    await expect(
      rewriteSelection(
        'key',
        'Report',
        'Selection',
        'Improve',
        new AbortController().signal,
        () => {}
      )
    ).rejects.toThrow()
  })

  it('drops refused content and reports the refusal', async () => {
    mockStream('refusal')
    await expect(
      rewriteSelection(
        'key',
        'Report',
        'Selection',
        'Improve',
        new AbortController().signal,
        () => {}
      )
    ).rejects.toThrow()
  })
})
