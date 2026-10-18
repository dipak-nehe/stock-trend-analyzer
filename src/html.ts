// Text from filings, the visitor or the API, made safe to put inside HTML (element text or a quoted attribute).
const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export const esc = (s: string | number | null | undefined): string => String(s ?? "").replace(/[&<>"']/g, (c) => ENTITIES[c] ?? c);
