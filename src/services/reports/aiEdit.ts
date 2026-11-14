import { create } from 'zustand'
import { translate } from '../../i18n/index.js'
import { createId } from '../../utils/id.js'
import { useSettings } from '../settings.js'
import { rewriteSelection } from './rewrite.js'
import { saveActiveReport, updateReportContent, useReportStore } from './store.js'

export type AiEditStatus = 'idle' | 'streaming' | 'ready' | 'error' | 'stale'

export type AiEditSuggestion = {
  id: string
  reportId: string
  instruction: string
  originalText: string
  revisedText: string
  start: number
  end: number
}

type AiEditState = {
  status: AiEditStatus
  suggestion: AiEditSuggestion | null
  error: string | null
}

export const useAiEditStore = create<AiEditState>(() => ({
  status: 'idle',
  suggestion: null,
  error: null,
}))

const { getState: get, setState: set } = useAiEditStore
let controller: AbortController | null = null
let operationSequence = 0

export const startAiEdit = async (
  instruction: string,
  start: number,
  end: number
): Promise<boolean> => {
  if (get().status === 'streaming' || !instruction.trim()) {
    return false
  }
  if (!(await saveActiveReport())) {
    return false
  }
  const draft = useReportStore.getState().draft
  const originalText = draft?.content.slice(start, end) ?? ''
  if (!draft || !originalText || start < 0 || end <= start) {
    return false
  }
  const sequence = ++operationSequence
  const id = createId()
  controller = new AbortController()
  set({
    status: 'streaming',
    suggestion: {
      id,
      reportId: draft.id,
      instruction: instruction.trim(),
      originalText,
      revisedText: '',
      start,
      end,
    },
    error: null,
  })
  try {
    const revisedText = await rewriteSelection(
      useSettings.getState().apiKey ?? '',
      draft.title,
      originalText,
      instruction.trim(),
      controller.signal,
      (text) => {
        const current = get().suggestion
        if (sequence === operationSequence && current?.id === id && get().status === 'streaming') {
          set({ suggestion: { ...current, revisedText: text } })
        }
      }
    )
    if (sequence !== operationSequence || get().suggestion?.id !== id || get().status === 'stale') {
      return false
    }
    const current = get().suggestion
    if (!current) {
      return false
    }
    set({ status: 'ready', suggestion: { ...current, revisedText } })
    return true
  } catch (error) {
    if (sequence !== operationSequence) {
      return false
    }
    if (controller?.signal.aborted) {
      set({ status: 'idle', suggestion: null, error: null })
    } else {
      set({
        status: 'error',
        suggestion: null,
        error: error instanceof Error ? error.message : translate('unknownError'),
      })
    }
    return false
  } finally {
    if (sequence === operationSequence) {
      controller = null
    }
  }
}

export const cancelAiEdit = () => {
  operationSequence += 1
  controller?.abort()
  controller = null
  set({ status: 'idle', suggestion: null, error: null })
}

export const rejectAiEdit = () => {
  if (get().status !== 'streaming') {
    set({ status: 'idle', suggestion: null, error: null })
  }
}

export const acceptAiEdit = async (): Promise<boolean> => {
  const { status, suggestion } = get()
  const draft = useReportStore.getState().draft
  if (status !== 'ready' || !suggestion || !draft || draft.id !== suggestion.reportId) {
    return false
  }
  if (draft.content.slice(suggestion.start, suggestion.end) !== suggestion.originalText) {
    set({ status: 'stale' })
    return false
  }
  const content =
    draft.content.slice(0, suggestion.start) +
    suggestion.revisedText +
    draft.content.slice(suggestion.end)
  updateReportContent(content)
  const saved = await saveActiveReport('ai-edit')
  if (saved) {
    set({ status: 'idle', suggestion: null, error: null })
  }
  return saved
}

useReportStore.subscribe((state) => {
  const { status, suggestion } = get()
  if ((status !== 'streaming' && status !== 'ready') || !suggestion) {
    return
  }
  if (
    state.draft?.id !== suggestion.reportId ||
    state.draft.content.slice(suggestion.start, suggestion.end) !== suggestion.originalText
  ) {
    set({ status: 'stale' })
  }
})
