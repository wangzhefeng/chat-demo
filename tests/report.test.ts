import { describe, expect, it } from 'vitest'
import { createReportSnapshot, exportReport } from '../src/services/reports/report.js'
import { makeReply, makeSession } from './reportFixtures.js'

describe('report snapshots', () => {
  it('copies answer Markdown, provenance and real sources without thinking or tools', () => {
    const reply = makeReply()
    const report = createReportSnapshot(makeSession(), reply, Date.UTC(2026, 0, 3))

    expect(report).not.toBeNull()
    expect(report?.content).toBe('## 结论\n\n保留 **Markdown** 内容。')
    expect(report?.content).not.toContain('internal reasoning')
    expect(report?.source).toEqual({
      sessionId: 'session-1',
      messageId: 'reply-1',
      sessionTitle: 'Research session',
      messageCreatedAt: Date.UTC(2026, 0, 2, 3, 4, 5),
    })
    expect(report?.sources).toHaveLength(1)
    expect(report?.sources[0]?.url).toBe('https://example.com/evidence')

    reply.blocks.push({ type: 'text', text: '后来生成的内容' })
    expect(report?.content).not.toContain('后来生成的内容')
  })

  it('does not create a report without answer text', () => {
    const reply = makeReply('empty')
    reply.blocks = [{ type: 'thinking', thinking: 'thinking only', signature: 'signature' }]
    expect(createReportSnapshot(makeSession('empty-session', reply), reply)).toBeNull()
  })

  it('exports standalone Markdown with links and timestamps', async () => {
    const report = createReportSnapshot(makeSession(), makeReply(), Date.UTC(2026, 0, 3))
    expect(report).not.toBeNull()
    if (!report) {
      return
    }
    const exported = exportReport(report)
    const markdown = await exported.blob.text()

    expect(exported.name).toBe('Research session-2026-01-03.md')
    expect(exported.blob.type).toBe('text/markdown;charset=utf-8')
    expect(markdown).toContain('# Research session')
    expect(markdown).toContain('保留 **Markdown** 内容。')
    expect(markdown).toContain('2026-01-02T03:04:05.000Z')
    expect(markdown).toContain('[Example source](<https://example.com/evidence>)')
    expect(markdown).not.toContain('[citation:')
  })
})
