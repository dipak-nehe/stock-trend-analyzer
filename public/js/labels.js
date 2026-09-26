// Display names for the metrics returned by the API, in the current language.
import { t } from "./i18n.js";

export const labelOf = (k) => t(`metric.${k}`);
