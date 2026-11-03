// The historical spending chart: NATO's own figures in real terms by financial year from 1950/51 to 2025/26, then the
// projection to 2035/36 (model.historical); as NATO counts them, or adjusted to SIPRI's definition (decision of
// 2 November 2026).
import { drawn, inputs, model } from "./data.js";
import { DEFAULTS } from "./model.js";
import { DW, applyShared, bn, downloadCsv, fixed, fyLabel, pointText, readHash, refresh, renderGroups, renderTiles, screenReaderHeading, settingsName, signed, writeHash } from "./ui.js";

const c = model.constants;
const lab = fyLabel;
const isNato = (s) => s.measure === "nato";
// What the model computes for a view: NATO's figures, adjusted to SIPRI's definition on "SIPRI's" (the page's choice
// stays in state.measure).
const modelOptions = (s) => ({ ...s, measure: "nato", nato_adjust: isNato(s) ? "none" : "sipri" });
// The deflator note describes only the deflator chosen (the user's request, 2 November 2026).
const DEFLATOR_NOTES = {
  YBGB: "Real terms: adjusted for inflation with the GDP deflator, the price of everything the UK produces.",
  YBFS: "Real terms: adjusted for inflation with the household consumption deflator, the prices households pay.",
  YBFU: "Real terms: adjusted for inflation with the investment deflator, the price of buildings and equipment.",
  YBFT: "Real terms: adjusted for inflation with the government consumption deflator, the cost of public services.",
};
// One list of assumptions, all above the results (the user's request, 2 November 2026).
const GROUPS = [
  { key: "measure", label: "Definitions", options: [
    { value: "nato", label: "NATO" }, { value: "sipri", label: "SIPRI" }],
    // Its note shows only while SIPRI is chosen (the user's request, 2 November 2026).
    help: (s) => (isNato(s) ? "" : "The SIPRI option aligns NATO data with SIPRI definitions. It bridges the methodological changes NATO introduced in 2001/02 and 2005/06, while incorporating about a third of the intelligence budget into the total consistently.") },
  // Real terms at 2025/26 prices, called out as the extra-spending tab's Units option does (the user's request,
  // 2 November 2026).
  { key: "deflator", label: `Deflator, ${lab(c.PRICE_YEAR)} prices`, options: [
    { value: "YBGB", label: "GDP" }, { value: "YBFS", label: "Household consumption" },
    { value: "YBFU", label: "Investment" }, { value: "YBFT", label: "Government consumption" }],
    help: (s) => DEFLATOR_NOTES[s.deflator] },
  { key: "path", label: `Path after ${lab(c.PLAN_YEARS.at(-1))}`, options: [
    { value: "step", label: "3% by 2030, then a line to 3.5%" }, { value: "nostep", label: "A line to 3.5% in 2035" }] },
  // Excluding Korea leaves out the drawdown after the war too, so its first year can't be the peak (the user's request,
  // 3 November 2026). The note, shown only then, is the user's shorter wording (the review of 3 November 2026).
  { key: "coldwar", label: "Cold War peak", options: [
    { value: "full", label: "Including the intervention in Korea" }, { value: "exkorea", label: "Excluding the intervention in Korea" }],
    help: (s) => (s.coldwar === "exkorea" ? `Leaves out the shaded years, ${lab(c.KOREA_DRAWDOWN[0])}–${lab(c.KOREA_DRAWDOWN[1])}.` : "") },
];
const KOREA = "the intervention in Korea";
// Straight after the intelligence note, on either definition (the review of 2 November 2026).
// It names the decade of the Cold War peak shown: on the government consumption deflator the 1950s, or the 1960s
// excluding Korea.
const decadeNote = (y) => `Whether the NATO ${Math.floor(y / 10) * 10}s figures counted the intelligence agencies is not known.`;
// The Targets sentence names 2030 only on the stepped path, the one with a 3% target (the review of 2 November 2026),
// and is singular on the straight path, which has one (the review of 3 November 2026). On the stepped path it says whose
// each target is, and that the government dates its target year as NATO does (the user's decision, the second review of
// 3 November 2026: NATO's labelling alone doesn't date a target NATO didn't set).
const plansNote = (path) => "Plans: the Defence Investment Plan's headline 2.6% of GDP in 2026/27 and 2.7% in "
  + "2027/28–2029/30 (precise shares move with each GDP forecast). " + (path === "step"
    ? "Targets: 3% is the government's own target and 3.5% a NATO target; the government and NATO both count a target "
      + "year as the financial year that starts in it, so 2030 and 2035 are 2030/31 and 2035/36."
    : "Target: NATO labels UK financial years by the year they start, so 2035 is 2035/36.");

const TAB = "historical";
const root = document.getElementById(TAB);
const el = (name) => root.querySelector(`[data-el="${name}"]`);
// The years come from the model: the last year, and the UK's target year before it.
const { LAST } = c;
const [UK_TARGET] = Object.keys(c.TARGETS).map(Number).sort((a, b) => a - b);
// The page opens on NATO's measure, as the model does (the user's decision, 2 November 2026; SIPRI until then).
const state = { ...DEFAULTS };
const prices = () => `${lab(c.PRICE_YEAR)} prices`;
readHash(GROUPS, state, TAB);
// The shaded bands: Korea, the plan years and the target years ("Targets" for both definitions, since on SIPRI's the
// line ends at NATO's 3.5% restated; "Target" on the straight path, which has one, as its caption says: the second
// review of 3 November 2026). One shade and 12px labels, with a white line between the plans and the targets, as on
// the extra-spending chart (the review of 2 November 2026). Set by update(), for the path chosen.
function bands(path) {
  const label = (text) => ({ text, style: { color: DW.note, fontSize: "12px", textOverflow: "clip", whiteSpace: "nowrap" }, useHTML: true, y: 14 });
  return [
    // Korea: the war and the drawdown after it, until spending stopped falling (3 November 2026; the war years until then).
    { from: c.KOREA_DRAWDOWN[0], to: c.KOREA_DRAWDOWN[1] + 0.5, color: DW.band, label: label("Korea") },
    { from: c.PLAN_YEARS[0] - 0.5, to: c.PLAN_YEARS.at(-1) + 0.5, color: DW.band, label: label("Plans") },
    { from: c.PLAN_YEARS.at(-1) + 0.5, to: LAST + 0.5, color: DW.band, label: label(path === "step" ? "Targets" : "Target") },
  ];
}
// Declared before the chart, whose first render calls drawPriceLabel.
let current, priceLabel;
const chart = Highcharts.chart(el("chart"), {
  chart: { type: "line", events: { render() { placePeakLabel(this); drawPriceLabel(this); } } },
  // The chart's description and the bands are set by update(), before the first drawing.
  accessibility: { screenReaderSection: { beforeChartFormat: screenReaderHeading("Historical spending chart") } },
  legend: { enabled: false },
  xAxis: {
    min: 1950, max: LAST + 0.5, tickInterval: 10, crosshair: { color: DW.grid },
    labels: { formatter() { return lab(this.value); } },
    // Screen readers heard "1 X axis displaying values" (the review of 3 November 2026).
    accessibility: { description: "Financial year", rangeDescription: `From ${lab(1950)} to ${lab(LAST)}.` },
    plotLines: [
      { value: 1991, color: "#c8c8c8", width: 1, label: { text: "End of the Cold War", rotation: 0, y: 14, x: 4, style: { color: DW.note, fontSize: "12px" } } },
      { value: c.PLAN_YEARS.at(-1) + 0.5, color: "#ffffff", width: 2, zIndex: 1 },
    ],
  },
  yAxis: { min: 0, labels: { formatter() { return `£${this.value}bn`; } }, accessibility: { description: `Spending, £bn at ${prices()}` } },
  tooltip: { formatter() { return tooltip(this.point); } },
  series: [
    { name: "NATO", color: DW.blue, lineWidth: 2, data: [] },
    { name: "Announced path", color: DW.blue, lineWidth: 2, dashStyle: "Dash", data: [],
      // Its first point is the NATO figure for 2025/26 that the path starts from, and screen readers hear it as that, as
      // the tooltip has it (the second review of 3 November 2026: they heard "Announced path").
      accessibility: { point: { descriptionFormatter: (p) =>
        pointText(p.x, p.x > c.PRICE_YEAR ? p.series.name : p.series.chart.series[0].name, p.y) } } },
  ],
});
renderGroups(el("main-controls"), GROUPS, state, update, "h");
update();
el("download").addEventListener("click", download);
root.addEventListener("tabshow", () => { applyShared(GROUPS, state); update(); chart.reflow(); });
drawn();

// Both lines' segments in pixels, and whether a box [left, top, right, bottom] crosses any of them: to keep labels off
// the lines.
// (Declarations, not constants: the chart's first render, before this point in the file, uses them.)
function lineSegments(ch) {
  return ch.series.slice(0, 2).flatMap((s) => s.points.slice(1).map((q, i) => [s.points[i], q]))
    .map(([a, z]) => [ch.plotLeft + a.plotX, ch.plotTop + a.plotY, ch.plotLeft + z.plotX, ch.plotTop + z.plotY]);
}
function crossesLines(segs, [l, t, r, b], pad = 3) {
  return segs.some(([x1, y1, x2, y2]) => {
    const n = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 2));
    for (let k = 0; k <= n; k++) {
      const x = x1 + ((x2 - x1) * k) / n, y = y1 + ((y2 - y1) * k) / n;
      if (x > l - pad && x < r + pad && y > t - pad && y < b + pad) return true;
    }
    return false;
  });
}

// The Cold War peak's label stays where it is unless it covers the peak's dot or crosses a line; then it moves to just
// left of the dot, or failing that just right of it (the user's request, 2 November 2026).
function placePeakLabel(ch) {
  const pl = ch.yAxis[0].plotLinesAndBands[0]?.label;
  const pt = current && ch.series[0]?.points.find((q) => q.x === current.peakYear);
  if (!pl || !pt || pt.plotX === undefined) return;
  const b = pl.getBBox(true), dx = ch.plotLeft + pt.plotX, dy = ch.plotTop + pt.plotY, segs = lineSegments(ch);
  const ok = (l) => l >= ch.plotLeft && l + b.width <= ch.plotLeft + ch.plotWidth
    && !(dx + 9 > l && dx - 9 < l + b.width && dy + 9 > b.y && dy - 9 < b.y + b.height)
    && !crossesLines(segs, [l, b.y, l + b.width, b.y + b.height], 1);
  const l = [b.x, dx - 12 - b.width, dx + 12].find(ok);
  if (l !== undefined && l !== b.x) pl.attr({ x: pl.attr("x") + l - b.x });
}

// The 2025/26 label, with an arrow to its point, redrawn each time the chart renders (the user's request, 2 November
// 2026). It goes at the first of a few spots round the point that keeps clear of both lines, the Cold War peak's line
// and the other labels, so it crosses no line in any view.
function drawPriceLabel(ch) {
  priceLabel?.destroy();
  priceLabel = undefined;
  const pt = ch.series[0]?.points.at(-1);
  if (!current || !pt || pt.plotY === undefined) return;
  const px = ch.plotLeft + pt.plotX, py = ch.plotTop + pt.plotY;
  const words = `£${pt.y.toFixed(1)}bn<br>in ${lab(pt.x)}`;
  const style = { fontSize: "12px", fontWeight: "700", color: DW.blue, textOutline: "3px #ffffff" };
  const probe = ch.renderer.text(words, 0, 0).css(style).add();
  const b = probe.getBBox(), w = b.width, h = b.height, pad = 3;
  probe.destroy();
  // What to keep clear of, in pixels: both lines' segments, the peak's line, and the other labels' boxes.
  const segs = lineSegments(ch);
  const peakY = ch.yAxis[0].toPixels(current.peak / 1000);
  const boxes = [
    ...ch.series.flatMap((s) => s.points.filter((q) => q.dataLabel).map(({ dataLabel: d }) =>
      [ch.plotLeft + d.x, ch.plotTop + d.y, ch.plotLeft + d.x + d.width, ch.plotTop + d.y + d.height])),
    ...[...ch.xAxis[0].plotLinesAndBands, ...ch.yAxis[0].plotLinesAndBands].filter((x) => x.label).map((x) => {
      const bb = x.label.getBBox(true); return [bb.x, bb.y, bb.x + bb.width, bb.y + bb.height]; }),
  ];
  const crosses = (l, t) => crossesLines(segs, [l, t, l + w, t + h], pad);
  const fits = (l, t) => l >= ch.plotLeft && l + w <= ch.plotLeft + ch.plotWidth && t >= ch.plotTop
    && t + h <= ch.plotTop + ch.plotHeight && !(peakY > t - pad && peakY < t + h + pad) && !crosses(l, t)
    && !boxes.some(([x1, y1, x2, y2]) => x1 < l + w + pad && l - pad < x2 && y1 < t + h + pad && t - pad < y2);
  const gap = 14;
  const spots = [[px + gap, py + gap], [px - gap - w, py - gap - h], [px - gap - w, py + gap], [px + gap, py - gap - h],
    [px + gap, py + 2.5 * gap], [px - w / 2, py - 3 * gap - h], [px - w / 2, py + 3 * gap]];
  const [l, t] = spots.find(([x, y]) => fits(x, y)) ?? spots[0];
  const g = ch.renderer.g("price-label").attr({ zIndex: 7 }).add();
  ch.renderer.text(words, l, t - b.y).css(style).add(g);
  // The arrow: from the label's nearest point to just short of the dot's white ring.
  const ax = Math.min(Math.max(px, l), l + w), ay = Math.min(Math.max(py, t), t + h);
  const d = Math.hypot(px - ax, py - ay), ux = (px - ax) / d, uy = (py - ay) / d;
  const tx = px - ux * 9, ty = py - uy * 9;
  const head = (s) => [tx - 6 * (ux * Math.cos(s) - uy * Math.sin(s)), ty - 6 * (uy * Math.cos(s) + ux * Math.sin(s))];
  ch.renderer.path(["M", ax, ay, "L", tx, ty]).attr({ stroke: DW.blue, "stroke-width": 1.5 }).add(g);
  ch.renderer.path(["M", ...head(0.5), "L", tx, ty, "L", ...head(-0.5)]).attr({ stroke: DW.blue, "stroke-width": 1.5, fill: "none" }).add(g);
  priceLabel = g;
}

function tooltip(point) {
  const r = current, i = point.series.index === 0 ? r.histYears.indexOf(point.x) : r.projYears.indexOf(point.x);
  const share = point.series.index === 0 ? r.histShare[i] : r.projShare[i];
  // The targets named, as on the extra-spending chart (the review of 2 November 2026).
  const restated = isNato(state) ? "" : ", restated on SIPRI definitions";
  const target = point.series.index !== 1 ? ""
    : point.x === LAST ? `<br>${c.TARGETS[LAST]}% of GDP target (NATO)${restated}`
      : point.x === UK_TARGET && state.path === "step" ? `<br>${c.TARGETS[UK_TARGET]}% of GDP target${restated}` : "";
  return `<b>${lab(point.x)}${point.series.index === 1 && point.x > c.PRICE_YEAR ? " (announced path)" : ""}</b><br>`
    // The peak year itself says so, rather than "+0.0% on the Cold War peak" (the review of 2 November 2026).
    + `£${point.y.toFixed(1)}bn at ${prices()}<br>${point.series.index === 0 && point.x === r.peakYear ? "Cold War peak"
      : `${signed(point.y * 1000 / r.peak - 1, 1)} on the Cold War peak${state.coldwar === "exkorea" && point.series.index === 0
        && point.x <= c.KOREA_DRAWDOWN[1] ? ", which leaves out Korea" : ""}`}<br>`
    + `${share.toFixed(2)}% of GDP${target}`;
}

// What the build-up test finds, in the build-up box's words.
function verdictOf(r) {
  return !r.holds
    ? (r.rivalRate >= r.now + c.CLEARLY
      ? `${lab(r.rival)}–${lab(r.rival + r.buildupYears)} was faster (${(r.rivalRate * 100).toFixed(1)}% a year)`
      : `About as fast as ${KOREA}, or faster`)
    : `${r.alike ? `About as fast as ${lab(r.rival)}–${lab(r.rival + r.buildupYears)}; only` : "Only"} ${KOREA} was faster`;
}

function targetWords(o, r) {
  const words = {
    step: `3% of GDP in ${lab(UK_TARGET)} and 3.5% in ${lab(LAST)}, with a line between`,
    nostep: `a line to 3.5% of GDP in ${lab(LAST)}`,
  }[o.path];
  if (isNato(o)) return words;
  // On SIPRI's definition the targets sit lower by the offset between the two measures.
  const off = c.TARGETS[LAST] - r.share2035;
  return `${words}, restated on SIPRI definitions as ${o.path === "step" ? `${(c.TARGETS[UK_TARGET] - off).toFixed(2)}% and ` : ""}`
    + `${r.share2035.toFixed(2)}%`;
}

function update() {
  writeHash(GROUPS, state, DEFAULTS, TAB);
  refresh(GROUPS, state);
  const r = model.historical(modelOptions(state));
  current = r;
  const nato = isNato(state);
  const name = c.DEFLATOR_NAMES[state.deflator];
  // Rounded from the second box's figure, so the two agree (the user's decision, the second review of 3 November 2026).
  const pct = Number(fixed(r.vsPeak2035 * 100, 0));
  // The title in the user's words (2 November 2026): the year is in the subhead and the boxes.
  el("title").textContent = `At 3.5% of GDP NATO Target, UK Military `
    + `Spending Would Be ${Math.abs(pct)}% ${pct >= 0 ? "above" : "below"} Its Cold War Peak`;
  el("description").textContent = `UK military spending in real terms on ${nato ? "NATO" : "SIPRI"} definitions, £bn at `
    + `${prices()} (${name}), financial years, ${lab(r.histYears[0])}–${lab(LAST)}. ${nato ? "NATO figures" : "NATO figures, adjusted to SIPRI definitions,"} `
    + `to ${lab(c.PRICE_YEAR)}; dashed: the announced path, UK plans to ${lab(c.PLAN_YEARS.at(-1))}, then ${targetWords(state, r)}.`;

  const real = new Map(r.histYears.map((y, i) => [y, r.realHist[i]]));
  const growth = real.get(c.PRICE_YEAR) / real.get(r.buildupStart) - 1;
  const verdict = verdictOf(r);
  const tiles = [
    [`${lab(c.PRICE_YEAR)} vs Cold War peak`, signed(r.vsPeak2025, 1),
      `${bn(real.get(c.PRICE_YEAR))} (NATO estimate); peak ${bn(r.peak)} in ${lab(r.peakYear)}`],
    [`${lab(LAST)} vs Cold War peak`, signed(r.vsPeak2035, 1), `${bn(r.realProj.at(-1))} at ${prices()}`],
    // Spans of years take an en dash, as TSP's style guide asks (the user's request, 2 November 2026); text only
    // screen readers hear keeps "to".
    [`Buildup, ${lab(r.buildupStart)}–${lab(c.PRICE_YEAR)}`, signed(growth, 1), `${(r.now * 100).toFixed(1)}% a year. ${verdict}.`],
  ];
  renderTiles(el("tiles"), tiles);

  const hist = r.histYears.map((y, i) => [y, r.realHist[i] / 1000]);
  const proj = r.projYears.map((y, i) => [y, r.realProj[i] / 1000]);
  // Labels in the line's colour, bold, with a 3px white halo, and the targets marked with a white-ringed dot: 3.5% in
  // 2035/36 and, on the stepped path, 3% in 2030/31, as on the extra-spending chart (the review of 2 November 2026).
  const label = (text, align, x, y) => ({ enabled: true, useHTML: false, align, x, y, formatter: () => text, style: { fontSize: "12px", fontWeight: "700", color: DW.blue, textOutline: "3px #ffffff" } });
  const mark = { enabled: true, symbol: "circle", radius: 5, fillColor: DW.blue, lineColor: "#ffffff", lineWidth: 2 };
  // 2025/26 is marked as the targets are; its label, with an arrow, is drawn by drawPriceLabel.
  hist[hist.length - 1] = { x: c.PRICE_YEAR, y: hist.at(-1)[1], marker: mark };
  // So is the Cold War peak, in every view (the user's request, 2 November 2026); placePeakLabel keeps its label clear.
  const pk = r.histYears.indexOf(r.peakYear);
  hist[pk] = { x: r.peakYear, y: hist[pk][1], marker: mark };
  // Highcharts hid the end label where the point sits high (on NATO figures, the government consumption and investment
  // deflators): its padded test found the Targets band label, which the label itself clears (3 November 2026).
  proj[proj.length - 1] = { x: LAST, y: proj.at(-1)[1], marker: mark,
    dataLabels: { ...label(`£${proj.at(-1)[1].toFixed(1)}bn`, "right", -8, -6), allowOverlap: true } };
  if (state.path === "step") {
    const t = r.projYears.indexOf(UK_TARGET);
    proj[t] = { x: UK_TARGET, y: proj[t][1], marker: mark };
  }
  chart.xAxis[0].update({ plotBands: bands(state.path) }, false);
  chart.yAxis[0].update({
    max: Math.max(...r.realProj, ...r.realHist) / 1000 * 1.12,
    // Screen readers hear the range in £bn rather than raw figures (the review of 3 November 2026).
    accessibility: { rangeDescription: `From ${bn(Math.min(...r.realHist, ...r.realProj))} to ${bn(Math.max(...r.realHist, ...r.realProj))}.` },
    plotLines: [{ value: r.peak / 1000, color: DW.dark, width: 1, zIndex: 3, label: {
      text: `Cold War peak: £${(r.peak / 1000).toFixed(1)}bn in ${lab(r.peakYear)}`, align: "left", x: 60, y: -6, style: { color: DW.dark, fontSize: "12px" } } }],
  }, false);
  // Screen readers hear the view chosen (the review of 2 November 2026).
  chart.update({ accessibility: { description: `UK military spending in real terms from ${lab(r.histYears[0])}${nato ? ""
    : ", on SIPRI definitions"}, with the announced path to ${lab(LAST)} on its way to 3.5% of GDP${nato ? ""
    : ` (${r.share2035.toFixed(2)}% on SIPRI definitions)`}.` } }, false);
  chart.series[0].update({ name: nato ? "NATO" : "NATO, on SIPRI definitions" }, false);
  chart.series[0].setData(hist, false, false, false);
  // Replaced rather than updated (the last argument), so the 3% marker doesn't stay on the straight path.
  chart.series[1].setData(proj, false, false, false);
  chart.redraw();
  el("source").textContent = `Chart: Transition Security Project • Source: Author's analysis of ${nato ? "NATO" : "NATO, SIPRI"}, `
    + "MOD, HM Treasury, OBR and ONS data";

  const notes = [];
  const n = inputs.nato_history;
  // One order on both tabs (the user's decision, 2 November 2026): the figures and their adjustments, intelligence, the
  // plans and targets, then GDP and prices.
  notes.push(`NATO figures for the UK: its archived annual reports to ${lab(n.archive_last)}, then its 2026 report `
    + `(${lab(c.PRICE_YEAR)} an estimate).`);
  if (nato) {
    // What bridging NATO's breaks with SIPRI's series would do to the headline: alone, and with the intelligence
    // adjustment too, as on SIPRI definitions (bridged holds both).
    const bridged = model.historical(modelOptions({ ...state, measure: "sipri" }));
    // The buildup test also skips periods between NATO's two bases before 1985/86, which decides its verdict on some
    // deflators, so the caption says so (the review of 2 November 2026).
    notes.push("The NATO series breaks in 2001/02 (accruals basis) and 2005/06 (military pensions added), and mixes two "
      + "bases before 1985/86 (its 1986 report restated only some earlier years); the buildup test skips periods across a "
      + `break or between the two bases. With the breaks bridged by the SIPRI series, the Cold War peak would be `
      + `${bn(bridged.peak)} rather than ${bn(r.peak)}, and ${lab(LAST)} ${signed(r.realProj.at(-1) / bridged.peak - 1)} on `
      + `it; on SIPRI definitions, which also adjust for intelligence (below), ${signed(bridged.vsPeak2035)}.`);
    // The announced path, the government's plans and targets, counts the whole intelligence account from 2026/27; NATO's
    // figures before then don't. The line isn't adjusted; the caption calls out the mismatch (decision of 2 November 2026).
    const without = r.realProj.at(-1) * (r.share2035 - c.NATO_SIPRI_GAP) / r.share2035;
    notes.push(`From ${lab(c.SIA_FROM)} the UK appears to count its whole intelligence budget (the Single Intelligence Account) in its `
      + `NATO figures, about ${c.NATO_SIPRI_GAP.toFixed(2)}% of GDP more than before: the announced path counts it; NATO `
      + `figures to 2025/26 do not. Without that change, ${lab(LAST)} would be ${signed(without / r.peak - 1)} on the Cold War peak rather than `
      + `${signed(r.vsPeak2035)}.`);
  } else {
    // Adjusted to SIPRI's definition (decision of 2 November 2026): NATO's breaks bridged with SIPRI's series, and the
    // announced path without the intelligence SIPRI doesn't count.
    notes.push("Adjusted to SIPRI definitions: the NATO breaks in 2001/02 (accruals basis) and 2005/06 (military pensions "
      + "added) are bridged with the SIPRI year-on-year change, each earlier year scaled to match. The buildup test skips "
      + "periods between the two NATO bases before 1985/86.");
    // The same sentence as on the extra-spending tab (the review of 2 November 2026).
    notes.push(`On SIPRI definitions the plans and targets are ${c.NATO_SIPRI_GAP.toFixed(2)}% of GDP lower from ${lab(c.SIA_FROM)}: `
      + "SIPRI counts about a third of the intelligence budget, which the UK's NATO figures count in full from then.");
  }
  // The plan years are the Plan's headline shares; more precise figures move with each GDP forecast, so the caption
  // says only that (decisions of 2 November 2026).
  notes.push(decadeNote(r.peakYear), plansNote(state.path));
  // After its forecast the OBR's long-term assumptions give only CPI and the GDP deflator, so household consumption is
  // assumed to grow with CPI, and investment and government consumption with the GDP deflator, as in the military
  // folder's build; the note names only the chosen one (the user's request, 2 November 2026). The forecasts are named
  // from the builds' sources (the second review of 3 November 2026).
  if (state.deflator !== "YBGB") notes.push(`After ${lab(c.OBR_LAST)} the ${name} is assumed to grow with the OBR long-term ${state.deflator === "YBFS" ? "CPI" : "GDP deflator"} (${c.OBR_LTD}).`);
  notes.push(`GDP and prices: ONS, then the OBR ${c.OBR_FORECAST} forecast and its long-term assumptions (${c.OBR_LTD}).`);
  notes.push(`Data as of ${inputs.data_date}.`);
  el("notes").textContent = notes.join(" ");
}

function download() {
  const r = current, nato = isNato(state);
  const rows = [
    ...r.histYears.map((y, i) => [y, lab(y), (r.realHist[i] / 1000).toFixed(3), r.histShare[i].toFixed(3), nato ? "NATO" : "NATO, on SIPRI definitions"]),
    ...r.projYears.slice(1).map((y, i) => [y, lab(y), (r.realProj[i + 1] / 1000).toFixed(3), r.projShare[i + 1].toFixed(3), "announced path"]),
  ];
  // A numeric year first, since Excel reads 2000/01 to 2011/12 as dates, and the file name records any other setting
  // that isn't the default (the user's decisions, 2 November 2026).
  const more = settingsName(GROUPS, state, DEFAULTS, ["measure"]);
  downloadCsv(`uk_military_spending_real_terms_to_2035_36_${state.measure}${more ? `_${more}` : ""}.csv`,
    ["year_starting", "financial_year", `real_gbp_bn_${lab(c.PRICE_YEAR).replace("/", "_")}_prices_${state.deflator}`, "share_of_gdp_pct", "basis"], rows);
}
