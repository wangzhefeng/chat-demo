import type { Source } from '../chat/view.js'

export type ReportOrigin = {
  sessionId: string
  messageId: string
  sessionTitle: string
  messageCreatedAt: number
}

export type Report = {
  id: string
  sourceKey: string
  title: string
  content: string
  source: ReportOrigin
  sources: Source[]
  createdAt: number
  updatedAt: number
  revision: number
}

export type ReportSaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict'

export type ReportVersionReason = 'ai-edit' | 'restore'

export type ReportVersion = {
  id: string
  reportId: string
  title: string
  content: string
  revision: number
  reason: ReportVersionReason
  createdAt: number
}
