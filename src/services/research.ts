import { translate, type TranslationKey } from '../i18n/index.js'

export type ResearchTemplate = 'general' | 'technology' | 'product' | 'factCheck'

export const RESEARCH_TEMPLATES: {
  id: ResearchTemplate
  label: TranslationKey
  instruction: TranslationKey
}[] = [
  {
    id: 'general',
    label: 'researchTemplateGeneral',
    instruction: 'researchTemplateGeneralInstruction',
  },
  {
    id: 'technology',
    label: 'researchTemplateTechnology',
    instruction: 'researchTemplateTechnologyInstruction',
  },
  {
    id: 'product',
    label: 'researchTemplateProduct',
    instruction: 'researchTemplateProductInstruction',
  },
  {
    id: 'factCheck',
    label: 'researchTemplateFactCheck',
    instruction: 'researchTemplateFactCheckInstruction',
  },
]

export const parseResearchLinks = (input: string): { links: string[]; invalid: string[] } => {
  const links: string[] = []
  const invalid: string[] = []
  for (const line of input
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)) {
    try {
      const url = new URL(line)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        invalid.push(line)
      } else if (!links.includes(url.href)) {
        links.push(url.href)
      }
    } catch {
      invalid.push(line)
    }
  }
  return { links, invalid }
}

export const buildResearchPrompt = ({
  template,
  question,
  scope,
  links,
}: {
  template: ResearchTemplate
  question: string
  scope: string
  links: string[]
}): string => {
  const definition =
    RESEARCH_TEMPLATES.find((item) => item.id === template) ?? RESEARCH_TEMPLATES[0]
  const sections = [
    `${translate('researchPromptTemplate')}: ${translate(definition.label)}`,
    `${translate('researchPromptQuestion')}: ${question.trim()}`,
  ]
  if (scope.trim()) {
    sections.push(`${translate('researchPromptScope')}: ${scope.trim()}`)
  }
  if (links.length > 0) {
    sections.push(
      `${translate('researchPromptLinks')}:\n${links.map((link) => `- ${link}`).join('\n')}`
    )
  }
  sections.push(
    `${translate('researchPromptRequirements')}:\n- ${translate(definition.instruction)}\n- ${translate('researchPromptEvidence')}\n- ${translate('researchPromptOutput')}`
  )
  return sections.join('\n\n')
}
