import { test } from "node:test";
import assert from "node:assert/strict";
import { shareHtml, shareLinks } from "../../src/share.ts";
import { setLang } from "../../src/i18n.ts";

const share = { url: "https://stock-value-analysis.vercel.app/stock/BRK-B?lang=es", text: "AT&T vs KO: 10 years", subject: "Stock Value Analysis: AT&T" };

test("each network gets its own share address, with the link and message encoded", () => {
  const l = shareLinks(share);
  assert.equal(l.linkedin, "https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fstock-value-analysis.vercel.app%2Fstock%2FBRK-B%3Flang%3Des");
  assert.equal(l.x, "https://x.com/intent/tweet?text=AT%26T%20vs%20KO%3A%2010%20years&url=https%3A%2F%2Fstock-value-analysis.vercel.app%2Fstock%2FBRK-B%3Flang%3Des");
  const gmail = new URL(l.gmail);
  assert.equal(gmail.origin + gmail.pathname, "https://mail.google.com/mail/");
  assert.equal(gmail.searchParams.get("su"), "Stock Value Analysis: AT&T");
  assert.equal(gmail.searchParams.get("body"), "AT&T vs KO: 10 years\n\nhttps://stock-value-analysis.vercel.app/stock/BRK-B?lang=es");
  assert.equal(new URL(shareLinks({ url: "https://x.y/", text: "hi" }).gmail).searchParams.get("su"), "hi");  // subject defaults to the text
});

test("the share row opens each network in a new tab, with names for screen readers, in the page's language", () => {
  setLang("en");
  const html = shareHtml(share);
  assert.equal((html.match(/target="_blank" rel="noopener noreferrer"/g) || []).length, 3);
  assert.match(html, /aria-label="Share on LinkedIn \(opens in a new tab\)">LinkedIn ↗<\/a> · .*>X ↗<\/a> · .*>Gmail ↗<\/a>/);
  assert.match(html, /&amp;/);   // the addresses are escaped inside href
  setLang("es");
  try { assert.match(shareHtml(share), /Compartir:.*Compartir en Gmail/); } finally { setLang("en"); }
});
