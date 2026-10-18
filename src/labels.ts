// Display names for the metrics returned by the API, in the current language.
import { t } from "./i18n.ts";

export const labelOf = (k: string): string => t(`metric.${k}`);
