// What both pages share: the assumption controls, the state kept in the address (so a view can be linked to), the
// CSV download and number formats.

export const fyLabel = (y) => `${y}/${String((y + 1) % 100).padStart(2, "0")}`;
// A value that rounds to zero is written as zero, never "-0.0" (the review of 3 November 2026). A whole number is
// rounded from the figure to one decimal, as the boxes give it, so the two agree: £155.475bn is £155.5bn and £156bn,
// not £155bn (the user's decision, the second review of 3 November 2026).
const unsigned = (v, digits) => {
  const r = digits === 0 ? Number(v.toFixed(1)) : v;
  return Math.abs(r) < 0.5 * 10 ** -digits ? 0 : r;
};
export const fixed = (v, digits) => unsigned(v, digits).toFixed(digits);
export const bn = (gbpM, digits = 1) =>
  `£${unsigned(gbpM / 1000, digits).toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits })}bn`;
export const signed = (fraction, digits = 0) => {
  const v = unsigned(fraction * 100, digits);
  return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}%`;
};

// The page shows one calculator at a time, in tabs. The address holds the shown one's tab (unless it is the first) and
// its assumptions, so any view can be linked to.
export const TABS = ["historical", "extra"];
export const page = { tab: new URLSearchParams(location.hash.slice(1)).get("tab") ?? TABS[0] };
if (!TABS.includes(page.tab)) page.tab = TABS[0];

// The choices the two tabs share (decisions of 2 November 2026): a tab that opens takes them as the tab shown before it
// had them, whether picked there, given in the address or that tab's own default. So the measure the page opens on
// holds on both tabs until it is changed on either.
const SHARED = ["measure", "path"];
const chosen = {};

// Takes the shared choices into a tab's state and ticks its controls to match.
export function applyShared(groups, state) {
  for (const g of groups) {
    if (g.key in chosen && g.options.some((o) => String(o.value) === String(chosen[g.key]))) state[g.key] = chosen[g.key];
    g.inputs.forEach((input, i) => { input.checked = String(state[g.key]) === String(g.options[i].value); });
  }
}

// Each group: { key, label, options: [{ value, label }], help?, when? }, where help is a note under the options, or a
// function of the state giving it, and when, a function of the state, hides the group while it is false (its choice
// doesn't apply). Radio inputs styled as a segmented control, so they work by keyboard and with screen readers. The
// prefix keeps each tab's inputs apart.
export function renderGroups(container, groups, state, onChange, prefix) {
  container.replaceChildren();
  for (const g of groups) {
    const row = document.createElement("div");
    row.className = "group";
    const label = document.createElement("span");
    label.className = "group-label";
    label.id = `${prefix}-label-${g.key}`;
    label.textContent = g.label;
    const seg = document.createElement("div");
    seg.className = "seg";
    seg.setAttribute("role", "radiogroup");
    seg.setAttribute("aria-labelledby", label.id);
    g.inputs = g.options.map((opt, i) => {
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `${prefix}-group-${g.key}`;
      input.id = `${prefix}-opt-${g.key}-${i}`;
      input.checked = String(state[g.key]) === String(opt.value);
      input.addEventListener("change", () => { state[g.key] = opt.value; onChange(); });
      const l = document.createElement("label");
      l.htmlFor = input.id;
      l.textContent = opt.label;
      seg.append(input, l);
      return input;
    });
    row.append(label, seg);
    g.note = document.createElement("p");
    g.note.className = "group-note";
    g.note.id = `${prefix}-note-${g.key}`;
    g.seg = seg;
    g.row = row;
    row.append(g.note);
    container.append(row);
  }
  refresh(groups, state);
}

// Rewrites a group's option labels, by option value: for labels that carry figures.
export function relabel(group, labels) {
  group.inputs.forEach((input, i) => {
    const text = labels[group.options[i].value];
    if (text) input.nextElementSibling.textContent = text;
  });
}

// Writes each group's note for the current state; an empty note is hidden, and describes nothing. A group whose choice
// doesn't apply is hidden.
export function refresh(groups, state) {
  for (const g of groups) {
    g.row.hidden = g.when ? !g.when(state) : false;
    g.note.textContent = (typeof g.help === "function" ? g.help(state) : g.help) ?? "";
    if (g.note.textContent) g.seg.setAttribute("aria-describedby", g.note.id);
    else g.seg.removeAttribute("aria-describedby");
  }
}

export function readHash(groups, state, tab) {
  if (tab !== page.tab) return;
  const params = new URLSearchParams(location.hash.slice(1));
  for (const g of groups) {
    const opt = g.options.find((o) => String(o.value) === params.get(g.key));
    if (opt) state[g.key] = opt.value;
  }
}

// What each tab needs to take its assumptions from the address again (readAddress); recorded by writeHash, which both
// tabs call on every update.
const views = {};

// Sets a tab's assumptions from the address when it is edited on the open page, and keeps its shared choices for the
// other tab (the review of 2 November 2026). The tab then updates as it does when shown.
export function readAddress(tab) {
  const v = views[tab];
  if (!v) return;
  const params = new URLSearchParams(location.hash.slice(1));
  Object.assign(v.state, v.defaults);
  for (const g of v.groups) {
    const opt = g.options.find((o) => String(o.value) === params.get(g.key));
    if (opt) v.state[g.key] = opt.value;
    if (SHARED.includes(g.key)) chosen[g.key] = v.state[g.key];
  }
}

// The shown tab writes its assumptions to the address, and keeps its shared choices for the other tab. The address is
// written after a short pause, so a burst of changes writes it once: browsers limit how often a page may rewrite it
// (Safari 100 times in 30 seconds, Firefox 200 in 10), and past that Safari throws, which stopped the page updating (the
// second review of 3 November 2026). A write that fails is skipped; the next puts the address right.
let pendingWrite;
export function writeHash(groups, state, defaults, tab) {
  views[tab] = { groups, state, defaults };
  if (tab !== page.tab) return;
  for (const g of groups) if (SHARED.includes(g.key)) chosen[g.key] = state[g.key];
  const params = new URLSearchParams();
  if (tab !== TABS[0]) params.set("tab", tab);
  for (const g of groups) if (String(state[g.key]) !== String(defaults[g.key])) params.set(g.key, String(state[g.key]));
  const hash = params.toString();
  clearTimeout(pendingWrite);
  pendingWrite = setTimeout(() => {
    try { history.replaceState(null, "", hash ? `#${hash}` : location.pathname + location.search); } catch { /* skipped */ }
  }, 300);
}

// The settings that aren't the default, for a download's file name, e.g. "deflator-YBFT_coldwar-exkorea" (the user's
// decision, 2 November 2026).
export const settingsName = (groups, state, defaults, skip = []) => groups
  .filter((g) => !skip.includes(g.key) && String(state[g.key]) !== String(defaults[g.key]))
  .map((g) => `${g.key}-${state[g.key]}`).join("_");

// Result tiles: [label, value, sub] each.
export function renderTiles(container, tiles) {
  container.replaceChildren(...tiles.map((texts) => {
    const div = document.createElement("div");
    div.className = "tile";
    ["label", "value", "sub"].forEach((cls, i) => {
      const p = document.createElement("p");
      p.className = cls;
      p.textContent = texts[i];
      div.append(p);
    });
    return div;
  }));
}

export function downloadCsv(filename, header, rows) {
  const cell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const text = [header, ...rows].map((r) => r.map(cell).join(",")).join("\n");
  const a = document.createElement("a");
  // The byte-order mark tells Excel the file is UTF-8, so £ survives.
  a.href = URL.createObjectURL(new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" }));
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// TSP's Datawrapper look, as ../../../MoD savings waterfall/ draws it (README, "Datawrapper style").
export const DW = {
  blue: "#388dff", teal: "#00968f", green: "#8cffa7", ink: "#181818", axis: "#a2a2a2", grid: "#e7e7e7",
  band: "#f3f3f3", note: "#656565", dark: "#333333",
};

// Screen readers hear each point as its financial year, its line and its value, in £bn to one decimal, not the raw
// numbers.
export const pointText = (x, line, y) => `${fyLabel(x)}, ${line}: £${y.toFixed(1)}bn.`;

export function highchartsDefaults() {
  Highcharts.setOptions({
    // No animation on redraws either (the second review of 3 November 2026): the plot first drew 56px to the left, over
    // the axis labels, and slid into place, while the labels drawn on it were already in place.
    chart: { style: { fontFamily: "Roboto, Arial, sans-serif" }, backgroundColor: "#ffffff", spacing: [8, 4, 8, 0], animation: false },
    title: { text: null },
    credits: { enabled: false },
    lang: { thousandsSep: "," },
    xAxis: { lineColor: DW.ink, tickLength: 0, labels: { style: { color: DW.axis, fontSize: "12px" } } },
    yAxis: { title: { text: null }, gridLineColor: DW.grid, labels: { style: { color: DW.axis, fontSize: "12px" } } },
    tooltip: { backgroundColor: "#ffffff", borderColor: "#d9d9d9", shadow: false, style: { color: DW.ink, fontSize: "12px" } },
    // No fading of the other series on hover: it faded the shaded gap and its label, and one historical line when the
    // pointer was on the other (the review of 2 November 2026).
    // Circles for every series' hover marker, as for the marked points (the user's request, 2 November 2026: Highcharts
    // gives the second series diamonds).
    plotOptions: { series: { marker: { enabled: false, symbol: "circle" }, states: { hover: { lineWidthPlus: 0 }, inactive: { enabled: false } },
      animation: false } },
    accessibility: { point: { descriptionFormatter: (point) => pointText(point.x, point.series.name, point.y) } },
  });
}

// A chart's heading for screen readers, which otherwise hear "Chart": Highcharts' own section, with this title.
export const screenReaderHeading = (title) =>
  Highcharts.getOptions().accessibility?.screenReaderSection?.beforeChartFormat?.replace("{chartTitle}", title);
