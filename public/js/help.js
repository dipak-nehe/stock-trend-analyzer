// Jargon: abbreviations with a hover definition, in the current language.
// (Each red flag's "why it matters" text lives with the flag, under flag.<id>.help in strings/.)
import { t } from "./i18n.js";

export const abbr = (term) => `<abbr title="${t(`term.${term}.def`)}">${t(`term.${term}`)}</abbr>`;
