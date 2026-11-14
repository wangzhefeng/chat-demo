import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { exportAppData, importAppData, readAppDataBackup } from '../src/services/appBackup.js'
import * as chatDb from '../src/services/chat/db.js'
import { createReportSnapshot } from '../src/services/reports/report.js'
import * as reportDb from '../src/services/reports/db.js'
import {
  addNoteFromMessage,
  createWorkspace,
  useWorkspaceStore,
} from '../src/services/workspaces/store.js'
import { makeReply, makeSession } from './reportFixtures.js'

describe('application backup', () => {
  it('exports and restores structured data with replacement semantics', async () => {
    const reply = makeReply('backup-reply')
    const session = makeSession('backup-session', reply)
    await chatDb.saveSession(session)
    const report = createReportSnapshot(session, reply)
    if (!report) {
      throw new Error('Expected report fixture')
    }
    await reportDb.createReport(report)
    const workspaceId = await createWorkspace('Backup workspace', 'Preserve research')
    await addNoteFromMessage(workspaceId, session, reply, 'Backup note')

    const { name, blob } = await exportAppData()
    expect(name).toMatch(/^chat-demo-backup-.*\.json$/)
    const backup = readAppDataBackup(await blob.text())
    expect(backup.sessions.map((item) => item.id)).toContain(session.id)
    expect(backup.reports.map((item) => item.id)).toContain(report.id)
    expect(backup.workspaces.map((item) => item.id)).toContain(workspaceId)
    expect(backup.notes.map((item) => item.title)).toContain('Backup note')

    await createWorkspace('Temporary workspace', 'Removed by import')
    await importAppData(new File([blob], 'backup.json', { type: 'application/json' }))

    expect(await chatDb.loadSession(session.id)).not.toBeUndefined()
    expect(await reportDb.loadReport(report.id)).not.toBeUndefined()
    const workspaces = useWorkspaceStore.getState().workspaces
    expect(workspaces.some((item) => item.id === workspaceId)).toBe(true)
    expect(workspaces.some((item) => item.name === 'Temporary workspace')).toBe(false)
    expect(useWorkspaceStore.getState().notes.some((item) => item.title === 'Backup note')).toBe(
      true
    )
  })

  it('rejects malformed backups before replacing data', () => {
    expect(() => readAppDataBackup('{"format":"wrong"}')).toThrow()
    expect(() => readAppDataBackup('not-json')).toThrow()
  })
})
