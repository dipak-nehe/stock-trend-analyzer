// Globals provided by <script> tags in public/index.html rather than by imports.

/** Chart.js 4 (public/vendor/chart.umd.min.js). Typed loosely: the app only uses a few calls. */
declare const Chart: {
  new (canvas: HTMLCanvasElement | null, config: object): { destroy(): void };
  getChart(canvas: HTMLCanvasElement): unknown;
};

interface Window {
  /** Vercel Web Analytics command queue. */
  va?: (...args: unknown[]) => void;
  vaq?: unknown[][];
  /** Vercel Speed Insights command queue. */
  si?: (...args: unknown[]) => void;
  siq?: unknown[][];
}
