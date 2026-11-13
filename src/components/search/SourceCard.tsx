import clsx from 'clsx'
import type { Source } from '../../services/chat/view.js'
import { formatDate } from '../../utils/format.js'
import { SiteLogo } from './SiteLogo.js'
import { useTranslate } from '../../i18n/index.js'
import styles from './SourceCard.module.css'

/** 显示为 YYYY/MM/DD；无法解析的日期原样显示 */
const formatPublishedAt = (value: string | null) => (value ? (formatDate(value, '/') ?? value) : '')

/**
 * 搜索结果卡片：站点图标与名称、日期、标题、摘要。
 * 元数据缺失时省略摘要，图标使用链接图标兜底。
 */
export const SourceCard = ({
  source,
  className,
  showEvidence = false,
}: {
  source: Source
  className?: string
  showEvidence?: boolean
}) => {
  const t = useTranslate()
  const date = formatPublishedAt(source.publishedAt)
  return (
    <a className={styles.anchor} href={source.url} target="_blank" rel="noreferrer">
      <div className={clsx(styles.card, className)}>
        <div className={styles.meta}>
          <SiteLogo url={source.siteIcon} className={styles.siteIcon} />
          {source.siteName ? <span className={styles.siteName}>{source.siteName}</span> : null}
          {source.siteName && date ? <span className={styles.divider} /> : null}
          {date ? <span className={styles.date}>{date}</span> : null}
        </div>
        <div className={styles.title}>{source.title}</div>
        {source.snippet ? <div className={styles.snippet}>{source.snippet}</div> : null}
        {showEvidence ? (
          <div className={styles.evidence}>
            {source.foundInSearch ? <span>{t('sourceFoundInSearch')}</span> : null}
            <span className={source.readStatus === 'failed' ? styles.failed : undefined}>
              {t(
                source.readStatus === 'read'
                  ? 'sourceRead'
                  : source.readStatus === 'failed'
                    ? 'sourceReadFailed'
                    : source.readStatus === 'reading'
                      ? 'sourceReading'
                      : 'sourceReadUnconfirmed'
              )}
            </span>
            {source.cited ? <span>{t('sourceCited')}</span> : null}
          </div>
        ) : null}
      </div>
    </a>
  )
}
