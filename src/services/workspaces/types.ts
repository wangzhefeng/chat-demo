export type WorkspaceMaterial = {
  id: string
  url: string
  title: string
  createdAt: number
}

export type ContextSelection = {
  sessionIds: string[]
  noteIds: string[]
  reportIds: string[]
  materialIds: string[]
}

export type Workspace = {
  id: string
  name: string
  description: string
  sessionIds: string[]
  reportIds: string[]
  materials: WorkspaceMaterial[]
  context: ContextSelection
  createdAt: number
  updatedAt: number
}

export type WorkspaceNote = {
  id: string
  workspaceId: string
  title: string
  content: string
  source: { sessionId: string; messageId: string }
  createdAt: number
  updatedAt: number
}

export type SessionMetadata = {
  sessionId: string
  favorite: boolean
  tags: string[]
}

export type WorkspaceContextItem = {
  id: string
  type: 'session' | 'note' | 'report' | 'material'
  title: string
}

export type RequestContextSnapshot = {
  workspaceId: string
  workspaceName: string
  items: WorkspaceContextItem[]
  text: string
}

export type WorkspaceSearchResult = {
  id: string
  type: WorkspaceContextItem['type']
  title: string
  excerpt: string
}
