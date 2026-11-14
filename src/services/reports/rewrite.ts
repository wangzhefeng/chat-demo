import { translate } from '../../i18n/index.js'
import { createId } from '../../utils/id.js'
import { streamMessage } from '../api/client.js'
import { applyEvent, getReplyText, settleReply } from '../chat/reply.js'
import type { AssistantMessage } from '../chat/types.js'

export const rewriteSelection = async (
  apiKey: string,
  reportTitle: string,
  selection: string,
  instruction: string,
  signal: AbortSignal,
  onText: (text: string) => void
): Promise<string> => {
  let reply: AssistantMessage = {
    id: createId(),
    role: 'assistant',
    createdAt: Date.now(),
    model: 'deepseek-flash',
    thinking: false,
    search: false,
    prefix: false,
    status: 'pending',
    blocks: [],
  }
  const blockIndexes = new Map<number, number>()
  const events = streamMessage(
    apiKey,
    {
      model: 'deepseek-flash',
      system: translate('reportAiSystem'),
      messages: [
        {
          role: 'user',
          content: translate('reportAiRequest', {
            title: reportTitle,
            instruction,
            selection,
          }),
        },
      ],
      thinking: { type: 'disabled' },
      safety_check: { level: 'high' },
      tools: [],
    },
    signal
  )
  for await (const event of events) {
    reply = applyEvent(reply, event, Date.now(), blockIndexes)
    onText(getReplyText(reply))
  }
  reply = settleReply(reply, 'done', Date.now())
  const text = getReplyText(reply)
  if (reply.stopReason === 'refusal') {
    throw new Error(translate('reportAiRefused'))
  }
  if (reply.stopReason !== 'end_turn') {
    throw new Error(translate('reportAiIncomplete'))
  }
  if (!text.trim()) {
    throw new Error(translate('reportAiEmpty'))
  }
  return text
}
