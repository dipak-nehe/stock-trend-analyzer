// Accessible names shared by the page objects. The site is bilingual, so each name matches the English or the
// Spanish text; one page object then works in both languages.

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The English or the Spanish text, exactly. */
export const either = (en: string, es: string) => new RegExp(`^(${escape(en)}|${escape(es)})$`);

/** Text starting with the English or the Spanish words (e.g. a tab name followed by a badge count). */
export const startsWith = (en: string, es: string) => new RegExp(`^(${escape(en)}|${escape(es)})`);

export type Tab = 'overview' | 'flags' | 'history' | 'value' | 'charts' | 'data';
export const TABS: readonly Tab[] = ['overview', 'flags', 'history', 'value', 'charts', 'data'];

/** Tab (and tab panel) names; a tab's name ends with its badge count when it has one. */
export const TAB_NAMES: Record<Tab, RegExp> = {
  overview: startsWith('Overview', 'Resumen'),
  flags: startsWith('Red flags', 'Señales de alerta'),
  history: startsWith('SEC history', 'Historial SEC'),
  value: startsWith('Graham & Buffett', 'Graham y Buffett'),
  charts: startsWith('Charts', 'Gráficos'),
  data: startsWith('Data', 'Datos'),
};

/** The guide card titles (English), by the tab each card opens. */
export const GUIDE_TITLES: Record<Tab, string> = {
  overview: 'Overview',
  flags: 'Red flags',
  history: 'SEC history',
  value: 'Graham & Buffett-style analysis',
  charts: 'Charts',
  data: 'Data',
};
