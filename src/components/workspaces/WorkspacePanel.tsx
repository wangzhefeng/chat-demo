import { useEffect, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { useChatStore } from '../../services/chat/store.js'
import { parseResearchLinks } from '../../services/research.js'
import { useReportStore } from '../../services/reports/store.js'
import {
  addWorkspaceMaterial,
  closeWorkspaces,
  createWorkspace,
  searchWorkspace,
  setSessionFavorite,
  setSessionTags,
  showWorkspaceList,
  toggleContextItem,
  toggleWorkspaceReport,
  toggleWorkspaceSession,
  updateWorkspace,
  useWorkspaceStore,
} from '../../services/workspaces/store.js'
import type { WorkspaceSearchResult } from '../../services/workspaces/types.js'
import { Button } from '../base/Button.js'
import { IconButton } from '../base/IconButton.js'
import { IconCloseOutline16 } from '../base/icons.js'
import styles from './WorkspacePanel.module.css'

export const WorkspacePanel = () => {
  const t = useTranslate()
  const ready = useWorkspaceStore((state) => state.ready)
  const loadError = useWorkspaceStore((state) => state.loadError)
  const isOpen = useWorkspaceStore((state) => state.isOpen)
  const activeId = useWorkspaceStore((state) => state.activeId)
  const workspaces = useWorkspaceStore((state) => state.workspaces)
  const notes = useWorkspaceStore((state) => state.notes)
  const metadata = useWorkspaceStore((state) => state.sessionMetadata)
  const sessions = useChatStore((state) => state.sessions)
  const reports = useReportStore((state) => state.reports)
  const workspace = workspaces.find((item) => item.id === activeId)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [createName, setCreateName] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<WorkspaceSearchResult[]>([])
  const [searched, setSearched] = useState(false)
  const [materialInput, setMaterialInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(workspace?.name ?? '')
    setDescription(workspace?.description ?? '')
    setQuery('')
    setResults([])
    setSearched(false)
    setError(null)
  }, [activeId, workspace?.name, workspace?.description])

  if (!isOpen) {
    return null
  }

  const search = async () => {
    if (!workspace) {
      return
    }
    const matches = await searchWorkspace(workspace.id, query)
    setResults(matches)
    setSearched(true)
  }

  const typeLabels = {
    session: t('workspaceSearchTypeSession'),
    note: t('workspaceSearchTypeNote'),
    report: t('workspaceSearchTypeReport'),
    material: t('workspaceSearchTypeMaterial'),
  }

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <div role="heading" className={styles.heading}>
          {workspace?.name || t('workspaces')}
        </div>
        <IconButton
          icon={<IconCloseOutline16 />}
          aria-label={t('close')}
          onClick={closeWorkspaces}
        />
      </div>
      {!ready ? (
        <div className={styles.empty}>{t('workspaceLoading')}</div>
      ) : !workspace ? (
        <div className={styles.list}>
          {loadError ? <div className={styles.error}>{t('workspaceSaveFailed')}</div> : null}
          <div className={styles.sectionTitle}>{t('workspaceList')}</div>
          {workspaces.length === 0 ? (
            <div className={styles.empty}>{t('workspaceEmpty')}</div>
          ) : (
            workspaces.map((item) => (
              <div key={item.id} className={styles.item}>
                <Button
                  variant="outlined"
                  onClick={() => useWorkspaceStore.setState({ activeId: item.id })}
                >
                  {item.name}
                </Button>
                <div className={styles.itemMeta}>{item.description}</div>
              </div>
            ))
          )}
          <div className={styles.sectionTitle}>{t('workspaceCreate')}</div>
          <div className={styles.createForm}>
            <input
              className={styles.input}
              aria-label={t('workspaceName')}
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
            />
            <textarea
              className={styles.textarea}
              aria-label={t('workspaceDescription')}
              placeholder={t('workspaceDescriptionPlaceholder')}
              value={createDescription}
              onChange={(event) => setCreateDescription(event.target.value)}
            />
            <Button
              onClick={() => {
                void createWorkspace(createName, createDescription)
                  .then(() => {
                    setCreateName('')
                    setCreateDescription('')
                  })
                  .catch(() => setError(t('workspaceSaveFailed')))
              }}
            >
              {t('workspaceCreate')}
            </Button>
            {error ? <div className={styles.error}>{error}</div> : null}
          </div>
        </div>
      ) : (
        <div className={styles.content}>
          {loadError ? <div className={styles.error}>{t('workspaceSaveFailed')}</div> : null}
          <Button variant="outlined" size="s" onClick={showWorkspaceList}>
            {t('workspaceBack')}
          </Button>
          <div className={styles.details}>
            <input
              className={styles.input}
              aria-label={t('workspaceName')}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <textarea
              className={styles.textarea}
              aria-label={t('workspaceDescription')}
              placeholder={t('workspaceDescriptionPlaceholder')}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <Button
              size="s"
              onClick={() =>
                void updateWorkspace(workspace.id, (current) => ({
                  ...current,
                  name: name.trim() || t('untitledWorkspace'),
                  description: description.trim(),
                }))
              }
            >
              {t('workspaceSave')}
            </Button>
          </div>
          <div className={styles.contextSummary}>
            {t('workspaceContextSelected', {
              count:
                workspace.context.sessionIds.length +
                workspace.context.noteIds.length +
                workspace.context.reportIds.length +
                workspace.context.materialIds.length,
            })}
          </div>
          <section className={styles.section}>
            <div className={styles.sectionTitle}>{t('workspaceSearch')}</div>
            <div className={styles.searchRow}>
              <input
                className={styles.input}
                aria-label={t('workspaceSearch')}
                placeholder={t('workspaceSearchPlaceholder')}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <Button variant="outlined" size="s" onClick={() => void search()}>
                {t('workspaceSearch')}
              </Button>
            </div>
            {searched && results.length === 0 ? (
              <div className={styles.empty}>{t('workspaceNoResults')}</div>
            ) : (
              results.map((result) => (
                <div key={`${result.type}:${result.id}`} className={styles.searchResult}>
                  <div>
                    {typeLabels[result.type]} · {result.title}
                  </div>
                  <div className={styles.searchExcerpt}>{result.excerpt}</div>
                </div>
              ))
            )}
          </section>
          <section className={styles.section}>
            <div className={styles.sectionTitle}>{t('workspaceSessions')}</div>
            {sessions.length === 0 ? (
              <div className={styles.empty}>{t('workspaceNoItems')}</div>
            ) : (
              [...sessions]
                .sort((a, b) => {
                  const favorite = (id: string) =>
                    metadata.find((item) => item.sessionId === id)?.favorite ? 1 : 0
                  return favorite(b.id) - favorite(a.id) || b.updatedAt - a.updatedAt
                })
                .map((session) => {
                  const associated = workspace.sessionIds.includes(session.id)
                  const meta = metadata.find((item) => item.sessionId === session.id)
                  return (
                    <div key={session.id} className={styles.item}>
                      <div className={styles.itemRow}>
                        <span className={styles.itemTitle}>
                          {session.title || t('untitledChat')}
                        </span>
                        <Button
                          variant="outlined"
                          size="s"
                          onClick={() => void toggleWorkspaceSession(workspace.id, session.id)}
                        >
                          {t(associated ? 'workspaceRemove' : 'workspaceAssociate')}
                        </Button>
                        {associated ? (
                          <Button
                            variant="outlined"
                            size="s"
                            onClick={() => void setSessionFavorite(session.id, !meta?.favorite)}
                          >
                            {t(meta?.favorite ? 'workspaceUnfavorite' : 'workspaceFavorite')}
                          </Button>
                        ) : null}
                      </div>
                      {associated ? (
                        <>
                          <input
                            className={styles.input}
                            aria-label={t('workspaceTags')}
                            defaultValue={meta?.tags.join(', ') ?? ''}
                            onBlur={(event) =>
                              void setSessionTags(session.id, event.target.value.split(/[,，]/))
                            }
                          />
                          <label className={styles.contextLabel}>
                            <input
                              type="checkbox"
                              checked={workspace.context.sessionIds.includes(session.id)}
                              onChange={() =>
                                void toggleContextItem(workspace.id, 'sessionIds', session.id)
                              }
                            />
                            {t('workspaceUseContext')}
                          </label>
                        </>
                      ) : null}
                    </div>
                  )
                })
            )}
          </section>
          <section className={styles.section}>
            <div className={styles.sectionTitle}>{t('workspaceNotes')}</div>
            {notes.filter((note) => note.workspaceId === workspace.id).length === 0 ? (
              <div className={styles.empty}>{t('workspaceNoItems')}</div>
            ) : (
              notes
                .filter((note) => note.workspaceId === workspace.id)
                .map((note) => (
                  <div key={note.id} className={styles.item}>
                    <div className={styles.itemTitle}>{note.title}</div>
                    <div className={styles.itemMeta}>{note.content.slice(0, 160)}</div>
                    <label className={styles.contextLabel}>
                      <input
                        type="checkbox"
                        checked={workspace.context.noteIds.includes(note.id)}
                        onChange={() => void toggleContextItem(workspace.id, 'noteIds', note.id)}
                      />
                      {t('workspaceUseContext')}
                    </label>
                  </div>
                ))
            )}
          </section>
          <section className={styles.section}>
            <div className={styles.sectionTitle}>{t('workspaceReports')}</div>
            {reports.length === 0 ? (
              <div className={styles.empty}>{t('workspaceNoItems')}</div>
            ) : (
              reports.map((report) => {
                const associated = workspace.reportIds.includes(report.id)
                return (
                  <div key={report.id} className={styles.item}>
                    <div className={styles.itemRow}>
                      <span className={styles.itemTitle}>{report.title}</span>
                      <Button
                        variant="outlined"
                        size="s"
                        onClick={() => void toggleWorkspaceReport(workspace.id, report.id)}
                      >
                        {t(associated ? 'workspaceRemove' : 'workspaceAssociate')}
                      </Button>
                    </div>
                    {associated ? (
                      <label className={styles.contextLabel}>
                        <input
                          type="checkbox"
                          checked={workspace.context.reportIds.includes(report.id)}
                          onChange={() =>
                            void toggleContextItem(workspace.id, 'reportIds', report.id)
                          }
                        />
                        {t('workspaceUseContext')}
                      </label>
                    ) : null}
                  </div>
                )
              })
            )}
          </section>
          <section className={styles.section}>
            <div className={styles.sectionTitle}>{t('workspaceMaterials')}</div>
            {workspace.materials.map((material) => (
              <div key={material.id} className={styles.item}>
                <a href={material.url} target="_blank" rel="noreferrer">
                  {material.title}
                </a>
                <label className={styles.contextLabel}>
                  <input
                    type="checkbox"
                    checked={workspace.context.materialIds.includes(material.id)}
                    onChange={() =>
                      void toggleContextItem(workspace.id, 'materialIds', material.id)
                    }
                  />
                  {t('workspaceUseContext')}
                </label>
              </div>
            ))}
            <textarea
              className={styles.textarea}
              aria-label={t('workspaceMaterials')}
              placeholder={t('workspaceMaterialPlaceholder')}
              value={materialInput}
              onChange={(event) => setMaterialInput(event.target.value)}
            />
            <Button
              variant="outlined"
              size="s"
              onClick={() => {
                const parsed = parseResearchLinks(materialInput)
                if (parsed.invalid.length > 0) {
                  setError(t('researchInvalidLinks'))
                  return
                }
                void (async () => {
                  for (const url of parsed.links) {
                    await addWorkspaceMaterial(workspace.id, url)
                  }
                  setMaterialInput('')
                  setError(null)
                })().catch(() => setError(t('workspaceSaveFailed')))
              }}
            >
              {t('workspaceAddMaterial')}
            </Button>
            {error ? <div className={styles.error}>{error}</div> : null}
          </section>
        </div>
      )}
    </aside>
  )
}
