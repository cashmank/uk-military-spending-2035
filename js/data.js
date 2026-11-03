// The model's inputs, loaded once for both tabs (the review of 2 November 2026: each tab loaded them itself, and a tab
// clicked before they arrived lost its linked settings). If they, or Highcharts, fail to load, or the tabs fail to
// draw, the page says so rather than showing empty charts.
import { DEFAULTS, createModel } from "./model.js";
import { highchartsDefaults } from "./ui.js";

// Until the tabs have drawn, any failure, here or in their first drawing, leaves the message alone on the page (the
// second review of 3 November 2026: the tabs, a download button and an empty "Assumptions" stayed, and failures after
// the data had loaded showed nothing). A later error doesn't blank a page already drawn.
let drawing = true, toDraw = 2;
// Each tab calls this when it has first drawn. Once both have, and any error either raised has been reported (a timer
// waits for that), errors no longer blank the page.
export function drawn() {
  if (--toDraw === 0) setTimeout(() => { drawing = false; });
}
function fail() {
  if (!drawing) return;
  document.querySelector('[data-el="load-error"]').hidden = false;
  document.querySelectorAll('[role="tablist"], [role="tabpanel"]').forEach((el) => el.remove());
}
// Only errors from the page's own scripts and Highcharts count (3 November 2026: once published, the message showed in
// Safari while the page drew in Chrome; scripts that browser extensions add to a page raise errors here too). The
// browser's own notices, such as a ResizeObserver loop, carry no error, and aren't failures either. The page's own
// promises are all awaited, so a rejection elsewhere isn't one of its failures.
const SITE = new URL(".", document.baseURI).href;
const ours = (file) => typeof file === "string" && (file.startsWith(SITE) || file.startsWith("https://cdn.jsdelivr.net/npm/highcharts@"));
window.addEventListener("error", (event) => {
  if (event.error && ours(event.filename)) fail();
  else if (drawing) console.warn("Not the page's own error, so the charts still draw:", event.message, event.filename);
});

// What the tabs read; an older copy of the data without one fails here, with the page's message, rather than leaving a
// tab blank or a caption ending "Data as of undefined." (the reviews of 3 November 2026). The model's own inputs are
// tried below.
const REQUIRED = ["FIRST", "BASE", "LAST", "PRICE_YEAR", "PLAN_YEARS", "TARGETS", "PATH_ANCHORS", "NATO_SIPRI_GAP",
  "KOREA", "KOREA_DRAWDOWN", "COLD_WAR_FULL", "COLD_WAR_EX_KOREA", "BUILDUP_START", "CLEARLY", "DEFLATORS",
  "DEFLATOR_NAMES", "SIA_FROM", "OBR_FORECAST", "OBR_LTD", "OBR_LAST"].map((key) => `constants.${key}`)
  .concat("data_date", "nato_2025_spring", "nato_history.archive_last");

async function load() {
  if (typeof Highcharts === "undefined") throw new Error("Highcharts did not load");
  // The extra-spending chart's shaded gap needs highcharts-more (the review of 2 November 2026), and screen readers
  // the accessibility module (the second review of 3 November 2026).
  if (!Highcharts.seriesTypes?.arearange) throw new Error("highcharts-more did not load");
  if (!Highcharts.getOptions().accessibility?.screenReaderSection) throw new Error("Highcharts' accessibility module did not load");
  // Checked with the server each time, so a browser can't pair new scripts with an old copy (the review of 3 November
  // 2026).
  const res = await fetch("data/model_inputs.json", { cache: "no-cache" });
  if (!res.ok) throw new Error(`data/model_inputs.json: HTTP ${res.status}`);
  const inputs = await res.json();
  const missing = REQUIRED.filter((path) => path.split(".").reduce((o, key) => o?.[key], inputs) === undefined);
  if (missing.length) throw new Error(`data/model_inputs.json lacks ${missing.join(", ")}: rebuild it`);
  // Roboto before the charts draw, so their labels are measured and placed in it (the review of 3 November 2026: the
  // fonts load with font-display: swap). Three seconds at most, then the charts draw anyway.
  if (document.fonts) {
    await Promise.race([Promise.all(["400 12px Roboto", "700 12px Roboto", "700 13px Roboto"].map((font) => document.fonts.load(font))),
      new Promise((resolve) => setTimeout(resolve, 3000))]).catch(() => {});
  }
  return inputs;
}

export let inputs, model;
try {
  inputs = await load();
  // Highcharts' defaults for both charts, set once.
  highchartsDefaults();
  model = createModel(inputs);
  // The model tried on each forecast and both definitions, so an input it lacks fails here, with the message.
  for (const gdp_vintage of ["latest", "spring2026", "summit"]) model.extra({ ...DEFAULTS, gdp_vintage });
  for (const nato_adjust of ["none", "sipri"]) model.historical({ ...DEFAULTS, nato_adjust });
} catch (error) {
  fail();
  throw error;
}
