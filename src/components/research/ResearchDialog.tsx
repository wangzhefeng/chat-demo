import { useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import {
  buildResearchPrompt,
  parseResearchLinks,
  RESEARCH_TEMPLATES,
  type ResearchTemplate,
} from '../../services/research.js'
import { Button } from '../base/Button.js'
import { Modal } from '../base/Modal.js'
import styles from './ResearchDialog.module.css'

export const ResearchDialog = ({
  initialQuestion,
  onApply,
  onClose,
}: {
  initialQuestion: string
  onApply: (prompt: string) => void
  onClose: () => void
}) => {
  const t = useTranslate()
  const [template, setTemplate] = useState<ResearchTemplate>('general')
  const [question, setQuestion] = useState(initialQuestion)
  const [scope, setScope] = useState('')
  const [links, setLinks] = useState('')
  const [error, setError] = useState<string | null>(null)

  const apply = () => {
    if (!question.trim()) {
      setError(t('researchQuestionRequired'))
      return
    }
    const parsed = parseResearchLinks(links)
    if (parsed.invalid.length > 0) {
      setError(`${t('researchInvalidLinks')}: ${parsed.invalid.join('、')}`)
      return
    }
    onApply(buildResearchPrompt({ template, question, scope, links: parsed.links }))
  }

  return (
    <Modal
      title={t('researchWorkbench')}
      className={styles.dialog}
      closable
      onClose={onClose}
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button onClick={apply}>{t('researchApply')}</Button>
        </>
      }
    >
      <div className={styles.form}>
        <label className={styles.field}>
          <span>{t('researchTemplate')}</span>
          <select
            value={template}
            onChange={(event) => setTemplate(event.target.value as ResearchTemplate)}
          >
            {RESEARCH_TEMPLATES.map((item) => (
              <option key={item.id} value={item.id}>
                {t(item.label)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>{t('researchQuestion')}</span>
          <textarea
            rows={3}
            value={question}
            placeholder={t('researchQuestionPlaceholder')}
            onChange={(event) => setQuestion(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>{t('researchScope')}</span>
          <textarea
            rows={2}
            value={scope}
            placeholder={t('researchScopePlaceholder')}
            onChange={(event) => setScope(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>{t('researchLinks')}</span>
          <textarea
            rows={4}
            value={links}
            placeholder={t('researchLinksPlaceholder')}
            onChange={(event) => setLinks(event.target.value)}
          />
        </label>
        <div className={styles.note}>{t('researchApplyNote')}</div>
        {error ? (
          <div className={styles.error} role="alert">
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
