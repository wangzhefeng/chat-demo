import type { AssistantMessage, Session } from '../src/services/chat/types.js'

export const makeReply = (id = 'reply-1'): AssistantMessage => ({
  id,
  role: 'assistant',
  createdAt: Date.UTC(2026, 0, 2, 3, 4, 5),
  model: 'deepseek-flash',
  thinking: true,
  search: true,
  prefix: true,
  status: 'done',
  stopReason: 'end_turn',
  parentId: `question-${id}`,
  blocks: [
    { type: 'thinking', thinking: 'internal reasoning', signature: 'signature' },
    {
      type: 'server_tool_use',
      id: `tool-${id}`,
      name: 'deepseek_web_search',
      input: { action: 'search', queries: ['markdown'] },
      caller: { type: 'direct' },
      kind: 'search',
    },
    {
      type: 'web_search_tool_result',
      tool_use_id: `tool-${id}`,
      kind: 'search',
      content: [
        {
          type: 'web_search_result',
          title: 'Example source',
          url: 'https://example.com/evidence',
          snippet: 'Evidence snippet',
          site_icon: null,
          site_name: 'Example',
          encrypted_content: 'encrypted',
          page_age: '2026-01-01T00:00:00Z',
        },
      ],
    },
    {
      type: 'text',
      text: '## 结论\n\n保留 **Markdown** 内容。',
      citations: [
        {
          type: 'web_search_result_location',
          url: 'https://example.com/evidence',
          title: 'Example source',
          cited_text: '保留 Markdown 内容。',
          encrypted_index: '',
        },
      ],
    },
  ],
})

export const makeSession = (id = 'session-1', reply = makeReply()): Session => ({
  id,
  title: 'Research session',
  createdAt: Date.UTC(2026, 0, 1),
  updatedAt: Date.UTC(2026, 0, 2),
  rootMessageId: `question-${reply.id}`,
  messages: [
    {
      id: `question-${reply.id}`,
      role: 'user',
      content: 'Research Markdown',
      files: [],
      createdAt: Date.UTC(2026, 0, 2),
      parentId: null,
      selectedChildId: reply.id,
    },
    { ...reply, selectedChildId: undefined },
  ],
})
