/** Where the browser tests reach the local server (started by Playwright's webServer, see playwright.config.ts). */
export const PORT = Number(process.env.E2E_PORT ?? 8799);
export const BASE_URL = `http://127.0.0.1:${PORT}`;
/** An absolute address on the test server, e.g. url('/?lang=es'). */
export const url = (path = '/') => `${BASE_URL}${path}`;
