import { useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import {
  acceptAiEdit,
  cancelAiEdit,
  rejectAiEdit,
  useAiEditStore,
} from '../../services/reports/aiEdit.js'
import { diffLines } from '../../services/reports/diff.js'
import { Button } from '../base/Button.js'
import styles from './AiEditReview.module.css'

export const AiEditReview = () => {
  const t = useTranslate()
  const status = useAiEditStore((state) => state.status)
  const suggestion = useAiEditStore((state) => state.suggestion)
  const error = useAiEditStore((state) => state.error)
  const [accepting, setAccepting] = useState(false)
  if (status === 'idle') {
    return null
  }
  if (status === 'error') {
    return (
      <div className={styles.review} role="alert">
        <div className={styles.error}>
          {t('reportAiFailed')}: {error}
        </div>
        <Button variant="outlined" size="s" onClick={rejectAiEdit}>
          {t('close')}
        </Button>
      </div>
    )
  }
  if (!suggestion) {
    return null
  }
  const lines = diffLines(suggestion.originalText, suggestion.revisedText)
  return (
    <div className={styles.review}>
      <div className={styles.status} role={status === 'stale' ? 'alert' : 'status'}>
        {t(
          status === 'streaming'
            ? 'reportAiStreaming'
            : status === 'stale'
              ? 'reportAiStale'
              : 'reportAiReady'
        )}
      </div>
      <div className={styles.diff} aria-label={t('reportAiEdit')}>
        {lines.map((line, index) => (
          <div key={index} className={styles[line.type]}>
            <span>{line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}</span>
            <span>{line.text || ' '}</span>
          </div>
        ))}
      </div>
      <div className={styles.actions}>
        {status === 'streaming' ? (
          <Button variant="outlined" size="s" onClick={cancelAiEdit}>
            {t('reportAiCancel')}
          </Button>
        ) : status === 'ready' ? (
          <>
            <Button variant="outlined" size="s" onClick={rejectAiEdit}>
              {t('reportAiReject')}
            </Button>
            <Button
              size="s"
              disabled={accepting}
              onClick={() => {
                setAccepting(true)
                void acceptAiEdit().finally(() => setAccepting(false))
              }}
            >
              {t('reportAiAccept')}
            </Button>
          </>
        ) : (
          <Button variant="outlined" size="s" onClick={rejectAiEdit}>
            {t('close')}
          </Button>
        )}
      </div>
    </div>
  )
}
