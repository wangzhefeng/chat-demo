import { useTranslate } from '../../i18n/index.js'
import { IconCloseOutline16 } from '../base/icons.js'
import { IconButton } from '../base/IconButton.js'
import { SourceCard } from '../search/SourceCard.js'
import { closeResearchPanel, useResearchPanel } from './researchPanelState.js'
import styles from './ResearchPanel.module.css'

export const ResearchPanel = () => {
  const t = useTranslate()
  const entry = useResearchPanel((state) => state.entry)
  const sources = useResearchPanel((state) => state.sources)
  const issues = useResearchPanel((state) => state.issues)
  if (!entry) {
    return null
  }
  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <div role="heading" className={styles.title}>
          {t('researchSources')}
        </div>
        <IconButton
          icon={<IconCloseOutline16 />}
          aria-label={t('close')}
          onClick={closeResearchPanel}
        />
      </div>
      <div className={styles.content}>
        {issues.map((issue) => (
          <div key={issue.id} className={styles.notice} role="alert">
            {t(issue.type === 'search-failed' ? 'researchSearchFailed' : 'researchSearchEmpty')}
          </div>
        ))}
        {sources.length > 0 && !sources.some((source) => source.cited) ? (
          <div className={styles.notice}>{t('researchNoCitations')}</div>
        ) : null}
        {sources.length === 0 ? (
          <div className={styles.empty}>{t('researchNoSources')}</div>
        ) : (
          sources.map((source) => (
            <SourceCard key={source.url} source={source} className={styles.item} showEvidence />
          ))
        )}
      </div>
    </aside>
  )
}
