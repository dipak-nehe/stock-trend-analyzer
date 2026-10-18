// "Share: LinkedIn · X · Gmail": links to each network's own share page, which opens in a new tab with the link and a
// short message filled in. The visitor signs in there (or already is): the site handles no logins, keys or data.
import { esc } from "./html.ts";
import { t } from "./i18n.ts";

export type Share = { url: string; text: string; subject?: string };

/** The three share addresses for a page. text is the short message; subject the email's (defaults to text). */
export function shareLinks({ url, text, subject = text }: Share) {
  const e = encodeURIComponent;
  return {
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${e(url)}`,
    x: `https://x.com/intent/tweet?text=${e(text)}&url=${e(url)}`,
    gmail: `https://mail.google.com/mail/?view=cm&fs=1&su=${e(subject)}&body=${e(`${text}\n\n${url}`)}`,
  };
}

/** The share row as HTML. */
export function shareHtml(share: Share): string {
  const l = shareLinks(share);
  const link = (key: "linkedin" | "x" | "gmail", label: string) =>
    `<a href="${esc(l[key])}" target="_blank" rel="noopener noreferrer" data-testid="share-${key}" aria-label="${esc(t("share.on", { site: label }))}">${esc(label)} ↗</a>`;
  return `<div class="share" data-testid="share"><span class="muted">${esc(t("share.label"))}</span> `
    + [link("linkedin", "LinkedIn"), link("x", "X"), link("gmail", "Gmail")].join(" · ") + "</div>";
}

/** The site's address for a path, in the page's language (a shared link opens in the language it was shared in). */
export function siteUrl(path: string, lang: string): string {
  const u = new URL(path, location.origin);
  if (lang !== "en") u.searchParams.set("lang", lang);
  return u.toString();
}
