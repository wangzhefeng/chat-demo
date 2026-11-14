import { useEffect, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { exportReport } from '../../services/reports/report.js'
import { cancelAiEdit, startAiEdit } from '../../services/reports/aiEdit.js'
import {
  closeReportPanel,
  initReports,
  openReport,
  openReportList,
  reloadActiveReport,
  saveActiveReport,
  updateReportContent,
  updateReportTitle,
  useReportStore,
} from '../../services/reports/store.js'
import { useSettings } from '../../services/settings.js'
import { Button } from '../base/Button.js'
import { IconButton } from '../base/IconButton.js'
import { IconCloseOutline16, IconDownloadOutline16 } from '../base/icons.js'
import { Modal } from '../base/Modal.js'
import { Markdown } from '../markdown/Markdown.js'
import { SourceCard } from '../search/SourceCard.js'
import { ensureApiKey } from '../settings/settingsDialogState.js'
import { AiEditReview } from './AiEditReview.js'
import { VersionHistory } from './VersionHistory.js'
import styles from './ReportPanel.module.css'

export const ReportPanel = () => {
  const t = useTranslate()
  const locale = useSettings((state) => state.locale)
  const ready = useReportStore((state) => state.ready)
  const loadError = useReportStore((state) => state.loadError)
  const reports = useReportStore((state) => state.reports)
  const isOpen = useReportStore((state) => state.isOpen)
  const activeId = useReportStore((state) => state.activeId)
  const draft = useReportStore((state) => state.draft)
  const saveStatus = useReportStore((state) => state.saveStatus)
  const saveError = useReportStore((state) => state.saveError)
  const pending = useReportStore((state) => state.pending)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [reloadConfirm, setReloadConfirm] = useState(false)
  const [selection, setSelection] = useState<{ start: number; end: number; text: string } | null>(
    null
  )
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [instruction, setInstruction] = useState('')

  useEffect(() => {
    setMode('edit')
    setReloadConfirm(false)
    setSelection(null)
    setAiDialogOpen(false)
    cancelAiEdit()
  }, [activeId])

  useEffect(() => {
    if (!isOpen) {
      cancelAiEdit()
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  const statusText = {
    saved: t('reportSaved'),
    dirty: t('reportUnsaved'),
    saving: t('reportSaving'),
    error: saveError ? `${t('reportSaveFailed')}: ${saveError}` : t('reportSaveFailed'),
    conflict: t('reportConflict'),
  }[saveStatus]

  const download = () => {
    if (!draft) {
      return
    }
    const { name, blob } = exportReport(draft)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <div role="heading" className={styles.heading}>
          {t('reports')}
        </div>
        <IconButton
          icon={<IconCloseOutline16 />}
          aria-label={t('close')}
          onClick={closeReportPanel}
        />
      </div>
      {pending || !ready ? (
        <div className={styles.empty} role="status">
          {loadError ? t('reportLoadFailed') : t('reportLoading')}
          {loadError ? (
            <Button variant="outlined" size="s" onClick={() => void initReports()}>
              {t('retry')}
            </Button>
          ) : null}
        </div>
      ) : !draft ? (
        <div className={styles.list}>
          {loadError ? (
            <div className={styles.alert} role="alert">
              {t('reportLoadFailed')}
            </div>
          ) : null}
          {reports.length === 0 ? (
            <div className={styles.empty}>{t('reportListEmpty')}</div>
          ) : (
            reports.map((report) => (
              <button
                type="button"
                key={report.id}
                className={styles.listItem}
                onClick={() => void openReport(report.id)}
              >
                <span className={styles.listTitle}>{report.title || t('untitledReport')}</span>
                <span className={styles.listMeta}>
                  {new Date(report.updatedAt).toLocaleString(locale)}
                </span>
              </button>
            ))
          )}
        </div>
      ) : (
        <div className={styles.editor}>
          <div className={styles.toolbar}>
            <Button variant="outlined" size="s" onClick={() => void openReportList()}>
              {t('reportBackToList')}
            </Button>
            <div className={styles.modeGroup}>
              <Button
                variant={mode === 'edit' ? 'primary' : 'outlined'}
                size="s"
                onClick={() => setMode('edit')}
              >
                {t('reportEdit')}
              </Button>
              <Button
                variant={mode === 'preview' ? 'primary' : 'outlined'}
                size="s"
                onClick={() => setMode('preview')}
              >
                {t('reportPreview')}
              </Button>
            </div>
            <Button
              variant="outlined"
              size="s"
              disabled={mode !== 'edit' || !selection || saveStatus === 'conflict'}
              onClick={() => setAiDialogOpen(true)}
            >
              {t('reportAiEdit')}
            </Button>
            <Button variant="outlined" size="s" onClick={download}>
              <IconDownloadOutline16 />
              {t('reportExport')}
            </Button>
            <Button
              size="s"
              disabled={
                saveStatus === 'saved' || saveStatus === 'saving' || saveStatus === 'conflict'
              }
              onClick={() => void saveActiveReport()}
            >
              {t('reportSave')}
            </Button>
          </div>
          <div
            className={styles.status}
            role={saveStatus === 'error' || saveStatus === 'conflict' ? 'alert' : 'status'}
          >
            {statusText}
          </div>
          <input
            className={styles.titleInput}
            aria-label={t('reportTitle')}
            value={draft.title}
            disabled={saveStatus === 'conflict'}
            onChange={(event) => updateReportTitle(event.target.value)}
          />
          {saveStatus === 'conflict' ? (
            <div className={styles.alert}>
              <span>{t('reportConflictDescription')}</span>
              <Button variant="outlined" size="s" onClick={() => setReloadConfirm(true)}>
                {t('reportReload')}
              </Button>
            </div>
          ) : null}
          <AiEditReview />
          {mode === 'edit' ? (
            <textarea
              className={styles.textarea}
              aria-label={t('reportContent')}
              value={draft.content}
              disabled={saveStatus === 'conflict'}
              onSelect={(event) => {
                const target = event.currentTarget
                const { selectionStart: start, selectionEnd: end } = target
                setSelection(
                  end > start ? { start, end, text: target.value.slice(start, end) } : null
                )
              }}
              onChange={(event) => {
                setSelection(null)
                updateReportContent(event.target.value)
              }}
            />
          ) : (
            <div className={styles.preview}>
              {draft.content ? (
                <Markdown
                  content={draft.content}
                  loading={false}
                  cacheKey={`${draft.id}-${draft.revision}`}
                  disableLink={false}
                />
              ) : (
                <div className={styles.empty}>{t('reportEmptyPreview')}</div>
              )}
            </div>
          )}
          <VersionHistory />
          {draft.sources.length > 0 ? (
            <details className={styles.sources}>
              <summary>
                {t('reportOriginalSources')} ({draft.sources.length})
              </summary>
              <div className={styles.sourceList}>
                {draft.sources.map((source) => (
                  <SourceCard key={source.url} source={source} />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      )}
      {reloadConfirm ? (
        <Modal
          title={t('reportReload')}
          onClose={() => setReloadConfirm(false)}
          footer={
            <>
              <Button variant="outlined" onClick={() => setReloadConfirm(false)}>
                {t('cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  void reloadActiveReport().then((loaded) => {
                    if (loaded) {
                      setReloadConfirm(false)
                    }
                  })
                }}
              >
                {t('reportReload')}
              </Button>
            </>
          }
        >
          {t('reportConflictReloadConfirm')}
        </Modal>
      ) : null}
      {aiDialogOpen && selection ? (
        <Modal
          title={t('reportAiEdit')}
          onClose={() => setAiDialogOpen(false)}
          footer={
            <>
              <Button variant="outlined" onClick={() => setAiDialogOpen(false)}>
                {t('cancel')}
              </Button>
              <Button
                disabled={!instruction.trim()}
                onClick={() => {
                  if (!ensureApiKey()) {
                    return
                  }
                  const { start, end } = selection
                  setAiDialogOpen(false)
                  void startAiEdit(instruction, start, end)
                }}
              >
                {t('reportAiStart')}
              </Button>
            </>
          }
        >
          <div className={styles.aiForm}>
            <div>
              <div className={styles.aiLabel}>{t('reportAiSelection')}</div>
              <pre className={styles.selectionPreview}>{selection.text}</pre>
            </div>
            <label className={styles.aiForm}>
              <span className={styles.aiLabel}>{t('reportAiInstruction')}</span>
              <textarea
                className={styles.instructionInput}
                rows={3}
                value={instruction}
                placeholder={t('reportAiInstructionPlaceholder')}
                onChange={(event) => setInstruction(event.target.value)}
              />
            </label>
          </div>
        </Modal>
      ) : null}
    </aside>
  )
}
