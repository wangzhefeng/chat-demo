import { describe, expect, it } from 'vitest'
import { buildReplyView } from '../src/services/chat/view.js'
import { buildResearchPrompt, parseResearchLinks } from '../src/services/research.js'
import { makeReply } from './reportFixtures.js'

describe('research input', () => {
  it('accepts multiple HTTP links, deduplicates them and rejects invalid input', () => {
    expect(
      parseResearchLinks(
        'https://example.com/a\nhttps://example.com/a\nftp://example.com/file\nnot-a-url'
      )
    ).toEqual({
      links: ['https://example.com/a'],
      invalid: ['ftp://example.com/file', 'not-a-url'],
    })
  })

  it('builds an editable prompt with template, scope, links and evidence requirements', () => {
    const prompt = buildResearchPrompt({
      template: 'technology',
      question: 'Which database fits?',
      scope: 'Two candidates only',
      links: ['https://example.com/a', 'https://example.com/b'],
    })
    expect(prompt).toContain('Technology selection')
    expect(prompt).toContain('Which database fits?')
    expect(prompt).toContain('Two candidates only')
    expect(prompt).toContain('- https://example.com/a\n- https://example.com/b')
    expect(prompt).toContain('Distinguish search results from successfully read pages')
    expect(prompt).toContain('items requiring verification')
  })
})

describe('research evidence', () => {
  it('does not treat search results or citations as proof of reading', () => {
    const view = buildReplyView(makeReply(), false)
    expect(view.sources).toHaveLength(1)
    expect(view.sources[0]).toMatchObject({
      foundInSearch: true,
      readStatus: 'unconfirmed',
      cited: true,
    })
    expect(view.answer?.portableMarkdown).toContain('[1](<https://example.com/evidence>)')
    expect(view.answer?.markdown).toContain('[citation:1]')
  })

  it('uses fetch results to distinguish successful and failed reads', () => {
    const reply = makeReply('fetch')
    reply.blocks.push(
      {
        type: 'server_tool_use',
        id: 'read-success',
        name: 'deepseek_read_url',
        input: { action: 'read_link', url: 'https://example.com/evidence' },
        caller: { type: 'direct' },
        kind: 'read_link',
      },
      {
        type: 'web_fetch_tool_result',
        tool_use_id: 'read-success',
        kind: 'read_link',
        signature: 'signature',
        content: {
          type: 'web_fetch_result',
          url: 'https://example.com/evidence',
          content: {
            type: 'document',
            source: { type: 'text', media_type: 'text/plain', data: '' },
            title: 'Read source',
          },
          published_at: null,
        },
      },
      {
        type: 'server_tool_use',
        id: 'read-failed',
        name: 'deepseek_read_url',
        input: { action: 'read_link', url: 'https://example.com/failed' },
        caller: { type: 'direct' },
        kind: 'read_link',
      },
      {
        type: 'web_fetch_tool_result',
        tool_use_id: 'read-failed',
        kind: 'read_link',
        content: {
          type: 'web_fetch_tool_result_error',
          error_code: 'url_not_accessible',
        },
      }
    )
    const view = buildReplyView(reply, false)
    expect(view.sources[0]).toMatchObject({ readStatus: 'read', cited: true })
    expect(view.sources[1]).toMatchObject({
      url: 'https://example.com/failed',
      readStatus: 'failed',
      foundInSearch: false,
      cited: false,
    })
  })

  it('reports failed and empty searches without inventing sources', () => {
    const reply = makeReply('issues')
    reply.blocks = reply.blocks.filter((block) => block.type !== 'text')
    reply.blocks.push(
      {
        type: 'server_tool_use',
        id: 'failed-search',
        name: 'deepseek_web_search',
        input: { action: 'search', queries: ['failure'] },
        caller: { type: 'direct' },
        kind: 'search',
      },
      {
        type: 'web_search_tool_result',
        tool_use_id: 'failed-search',
        kind: 'search',
        content: [{ type: 'web_search_tool_result_error', error_code: 'unavailable' }],
      },
      {
        type: 'server_tool_use',
        id: 'empty-search',
        name: 'deepseek_web_search',
        input: { action: 'search', queries: ['empty'] },
        caller: { type: 'direct' },
        kind: 'search',
      },
      {
        type: 'web_search_tool_result',
        tool_use_id: 'empty-search',
        kind: 'search',
        content: [],
      }
    )
    const view = buildReplyView(reply, false)
    expect(view.researchIssues.map((issue) => issue.type)).toEqual([
      'search-failed',
      'search-empty',
    ])
  })
})
