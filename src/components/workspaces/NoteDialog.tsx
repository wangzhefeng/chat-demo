import { useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import type { Message, Session } from '../../services/chat/types.js'
import {
  addNoteFromMessage,
  openWorkspaces,
  useWorkspaceStore,
} from '../../services/workspaces/store.js'
import { Button } from '../base/Button.js'
import { Modal } from '../base/Modal.js'
import styles from './NoteDialog.module.css'

export const NoteDialog = ({
  session,
  message,
  onClose,
}: {
  session: Session
  message: Message
  onClose: () => void
}) => {
  const t = useTranslate()
  const workspaces = useWorkspaceStore((state) => state.workspaces)
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? '')
  const [title, setTitle] = useState(
    `${message.role === 'user' ? t('contextUserMessage') : t('contextAssistantMessage')} · ${session.title || t('untitledChat')}`
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  return (
    <Modal
      title={t('workspaceAddNote')}
      className={styles.dialog}
      onClose={() => {
        if (!pending) {
          onClose()
        }
      }}
      footer={
        workspaces.length === 0 ? (
          <Button
            onClick={() => {
              openWorkspaces()
              onClose()
            }}
          >
            {t('noteOpenWorkspace')}
          </Button>
        ) : (
          <>
            <Button variant="outlined" disabled={pending} onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button
              disabled={pending || !workspaceId}
              onClick={() => {
                setPending(true)
                void addNoteFromMessage(workspaceId, session, message, title).then((saved) => {
                  setPending(false)
                  setError(!saved)
                  if (saved) {
                    onClose()
                  }
                })
              }}
            >
              {t('workspaceAddNote')}
            </Button>
          </>
        )
      }
    >
      {workspaces.length === 0 ? (
        <div>{t('noteNoWorkspace')}</div>
      ) : (
        <div className={styles.form}>
          <label>
            {t('noteTargetWorkspace')}
            <select value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)}>
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('noteTitle')}
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          {error ? <div className={styles.error}>{t('workspaceSaveFailed')}</div> : null}
        </div>
      )}
    </Modal>
  )
}
