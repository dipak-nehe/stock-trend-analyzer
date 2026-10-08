// Search-box suggestions as an accessible combobox: the input (role="combobox") owns a listbox of options; arrow keys
// move through them, Enter or a click picks one, Escape closes. Answers that arrive out of order are ignored.

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * @param {HTMLInputElement} input
 * @param {HTMLElement} list
 * @param {{ fetchResults: (q: string) => Promise<{ticker: string, name: string}[]>, onPick: (ticker: string) => void }} opts
 */
export function bindSuggest(input, list, { fetchResults, onPick }) {
  /** @type {{ticker: string, name: string}[]} */
  let items = [];
  let active = -1, seq = 0, timer = 0;
  const render = () => {
    list.innerHTML = items.map((r, i) => `<li role="option" id="sug-${i}" data-i="${i}" aria-selected="${i === active}">`
      + `<b>${esc(r.ticker)}</b> <span>${esc(r.name)}</span></li>`).join("");
    list.hidden = !items.length;
    input.setAttribute("aria-expanded", String(items.length > 0));
    if (active >= 0) input.setAttribute("aria-activedescendant", `sug-${active}`);
    else input.removeAttribute("aria-activedescendant");
  };
  const close = () => { items = []; active = -1; render(); };
  const pick = (/** @type {{ticker: string}} */ r) => { input.value = r.ticker; close(); onPick(r.ticker); };

  input.addEventListener("input", () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (!q) return close();
    timer = window.setTimeout(async () => {
      const mine = ++seq;
      let res = [];
      try { res = await fetchResults(q); } catch { /* no suggestions; typing a ticker still works */ }
      if (mine !== seq || input.value.trim() !== q) return;  // a newer request is on its way
      items = res; active = -1; render();
    }, 150);
  });
  input.addEventListener("keydown", (e) => {
    if (list.hidden || !items.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      active = active < 0 ? (step > 0 ? 0 : items.length - 1) : (active + step + items.length) % items.length;
      render();
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });
  // mousedown, not click: picking must happen before the input's blur closes the list
  list.addEventListener("mousedown", (e) => {
    const li = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest("li[data-i]"));
    if (!li) return;
    e.preventDefault();
    pick(items[Number(li.dataset.i)]);
  });
  input.addEventListener("blur", close);
  return { close };
}
