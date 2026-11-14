import { create } from 'zustand'
import type { ResearchIssue, Source } from '../../services/chat/view.js'

type ResearchPanelState = {
  entry: string | null
  sources: Source[]
  issues: ResearchIssue[]
}

export const useResearchPanel = create<ResearchPanelState>(() => ({
  entry: null,
  sources: [],
  issues: [],
}))

export const toggleResearchPanel = (entry: string, sources: Source[], issues: ResearchIssue[]) =>
  useResearchPanel.setState((state) =>
    state.entry === entry ? { entry: null, sources: [], issues: [] } : { entry, sources, issues }
  )

export const closeResearchPanel = () =>
  useResearchPanel.setState({ entry: null, sources: [], issues: [] })
