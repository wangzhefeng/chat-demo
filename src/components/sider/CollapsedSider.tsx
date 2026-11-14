import {
  IconDataOutline16,
  IconEditOutline16,
  IconPanelLeftOutline16,
  NewChatIcon,
} from '../base/icons.js'
import { closeWorkspaces, openWorkspaces } from '../../services/workspaces/store.js'
import { useTranslate } from '../../i18n/index.js'
import { setSiderCollapsed } from '../../services/settings.js'
import { newChat } from '../../services/chat/store.js'
import { closeReportPanel, openReports } from '../../services/reports/store.js'
import { closeSearchPanel } from '../search/searchPanelState.js'
import { closeResearchPanel } from '../research/researchPanelState.js'
import { IconButton } from '../base/IconButton.js'
import styles from './Sider.module.css'

/** 收起后左上角的按钮组 */
export const CollapsedSider = () => {
  const t = useTranslate()
  return (
    <div className={styles.collapsed}>
      <div className={styles.collapsedGroup}>
        <IconButton
          size="m"
          tone="primary"
          icon={<IconPanelLeftOutline16 />}
          tooltip={t('expandSiderbarButton')}
          onClick={() => setSiderCollapsed(false)}
        />
        <IconButton
          size="m"
          tone="primary"
          icon={<NewChatIcon />}
          tooltip={t('newChat')}
          onClick={newChat}
        />
        <IconButton
          size="m"
          tone="primary"
          icon={<IconDataOutline16 />}
          tooltip={t('workspaces')}
          onClick={() => {
            closeSearchPanel()
            closeResearchPanel()
            closeReportPanel()
            openWorkspaces()
          }}
        />
        <IconButton
          size="m"
          tone="primary"
          icon={<IconEditOutline16 />}
          tooltip={t('reports')}
          onClick={() => {
            closeSearchPanel()
            closeResearchPanel()
            openReports()
            closeWorkspaces()
          }}
        />
      </div>
    </div>
  )
}
