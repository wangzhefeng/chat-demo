import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { SessionMetadata, Workspace, WorkspaceNote } from './types.js'

interface WorkspaceDB extends DBSchema {
  workspaces: { key: string; value: Workspace }
  notes: { key: string; value: WorkspaceNote; indexes: { workspaceId: string } }
  sessionMetadata: { key: string; value: SessionMetadata }
}

let dbPromise: Promise<IDBPDatabase<WorkspaceDB>> | null = null

const getDB = () =>
  (dbPromise ??= openDB<WorkspaceDB>('chat-demo-workspaces', 1, {
    upgrade(db) {
      db.createObjectStore('workspaces', { keyPath: 'id' })
      const notes = db.createObjectStore('notes', { keyPath: 'id' })
      notes.createIndex('workspaceId', 'workspaceId')
      db.createObjectStore('sessionMetadata', { keyPath: 'sessionId' })
    },
  }).catch((error: unknown) => {
    dbPromise = null
    throw error
  }))

export const loadWorkspaces = async (): Promise<Workspace[]> => (await getDB()).getAll('workspaces')

export const loadNotes = async (): Promise<WorkspaceNote[]> => (await getDB()).getAll('notes')

export const loadSessionMetadata = async (): Promise<SessionMetadata[]> =>
  (await getDB()).getAll('sessionMetadata')

export const saveWorkspace = async (workspace: Workspace): Promise<void> => {
  await (await getDB()).put('workspaces', workspace)
}

export const saveNote = async (note: WorkspaceNote): Promise<void> => {
  await (await getDB()).put('notes', note)
}

export const saveSessionMetadata = async (metadata: SessionMetadata): Promise<void> => {
  await (await getDB()).put('sessionMetadata', metadata)
}
