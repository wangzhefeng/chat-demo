import { useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { restoreReportVersion, useReportStore } from '../../services/reports/store.js'
import type { ReportVersion } from '../../services/reports/types.js'
import { useSettings } from '../../services/settings.js'
import { Button } from '../base/Button.js'
import { Modal } from '../base/Modal.js'
import styles from './VersionHistory.module.css'

export const VersionHistory = () => {
  const t = useTranslate()
  const locale = useSettings((state) => state.locale)
  const versions = useReportStore((state) => state.versions)
  const saveStatus = useReportStore((state) => state.saveStatus)
  const [restoring, setRestoring] = useState<ReportVersion | null>(null)
  const [pending, setPending] = useState(false)
  return (
    <details className={styles.versions}>
      <summary>
        {t('reportVersions')} ({versions.length})
      </summary>
      <div className={styles.list}>
        {versions.length === 0 ? (
          <div className={styles.empty}>{t('reportVersionEmpty')}</div>
        ) : (
          versions.map((version) => (
            <div key={version.id} className={styles.version}>
              <div className={styles.meta}>
                <span>
                  {t(version.reason === 'ai-edit' ? 'reportVersionAiEdit' : 'reportVersionRestore')}
                </span>
                <time>{new Date(version.createdAt).toLocaleString(locale)}</time>
              </div>
              <div className={styles.excerpt}>{version.content.slice(0, 180)}</div>
              <Button
                variant="outlined"
                size="s"
                disabled={saveStatus === 'conflict' || saveStatus === 'saving'}
                onClick={() => setRestoring(version)}
              >
                {t('reportRestore')}
              </Button>
            </div>
          ))
        )}
      </div>
      {restoring ? (
        <Modal
          title={t('reportRestore')}
          onClose={() => {
            if (!pending) {
              setRestoring(null)
            }
          }}
          footer={
            <>
              <Button variant="outlined" disabled={pending} onClick={() => setRestoring(null)}>
                {t('cancel')}
              </Button>
              <Button
                variant="danger"
                disabled={pending}
                onClick={() => {
                  setPending(true)
                  void restoreReportVersion(restoring).then((restored) => {
                    setPending(false)
                    if (restored) {
                      setRestoring(null)
                    }
                  })
                }}
              >
                {t('reportRestore')}
              </Button>
            </>
          }
        >
          {t('reportRestoreConfirm')}
        </Modal>
      ) : null}
    </details>
  )
}
