import { translate } from '../../i18n/index.js'
import { formatDate } from '../../utils/format.js'
import { createId } from '../../utils/id.js'
import { buildReplyView } from '../chat/view.js'
import type { AssistantMessage, Session } from '../chat/types.js'
import type { Report } from './types.js'

export const reportSourceKey = (sessionId: string, messageId: string) => `${sessionId}:${messageId}`

export const createReportSnapshot = (
  session: Session,
  message: AssistantMessage,
  now = Date.now()
): Report | null => {
  const view = buildReplyView(message, false)
  if (!view.answer?.text) {
    return null
  }
  return {
    id: createId(),
    sourceKey: reportSourceKey(session.id, message.id),
    title: session.title || translate('untitledReport'),
    content: view.answer.text,
    source: {
      sessionId: session.id,
      messageId: message.id,
      sessionTitle: session.title,
      messageCreatedAt: message.createdAt,
    },
    sources: view.sources.map((source) => ({ ...source })),
    createdAt: now,
    updatedAt: now,
    revision: 0,
  }
}

const singleLine = (value: string) => value.replace(/\s*[\r\n]+\s*/g, ' ').trim()
const linkText = (value: string) =>
  value.replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]')
const isoTime = (value: number) => new Date(value).toISOString()

export const reportToMarkdown = (report: Report): string => {
  const title = singleLine(report.title) || translate('untitledReport')
  const sessionTitle = singleLine(report.source.sessionTitle) || translate('untitledChat')
  const sections = [
    `# ${title}`,
    [
      `> ${translate('reportSourceSession')}: ${sessionTitle}`,
      `> ${translate('reportSourceAnswerTime')}: ${isoTime(report.source.messageCreatedAt)}`,
      `> ${translate('reportUpdatedAt')}: ${isoTime(report.updatedAt)}`,
    ].join('\n'),
    report.content,
  ]
  if (report.sources.length > 0) {
    sections.push(
      [
        `## ${translate('reportOriginalSources')}`,
        ...report.sources.map(
          (source, index) =>
            `${index + 1}. [${linkText(source.title)}](<${source.url.replace(/[<>]/g, (char) => (char === '<' ? '%3C' : '%3E'))}>)`
        ),
      ].join('\n\n')
    )
  }
  return `${sections.join('\n\n')}\n`
}

export const exportReport = (report: Report): { name: string; blob: Blob } => {
  const date = formatDate(report.updatedAt) ?? formatDate(Date.now())
  const title = singleLine(report.title)
    .replace(/[\\/:*?"<>|]/g, '-')
    .slice(0, 80)
  return {
    name: `${title || 'report'}-${date}.md`,
    blob: new Blob([reportToMarkdown(report)], { type: 'text/markdown;charset=utf-8' }),
  }
}
