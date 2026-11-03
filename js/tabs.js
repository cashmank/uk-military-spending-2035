// The two calculators share the page, one tab each. Clicking a tab, or the arrow, Home and End keys on the tabs, shows one;
// its calculator then writes its own assumptions to the address and resizes its chart (the "tabshow" event). The tabs
// work once the data have loaded, so neither can be shown before its calculator is ready. The "tabshow" sent at load
// comes before the calculators listen; each draws itself when it starts.
import "./data.js";
import { page, readAddress, TABS } from "./ui.js";

const tabs = TABS.map((name) => document.getElementById(`tab-${name}`));

function show(name, focus = false) {
  page.tab = name;
  tabs.forEach((tab, i) => {
    const selected = TABS[i] === name;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    document.getElementById(TABS[i]).hidden = !selected;
    if (selected && focus) tab.focus();
  });
  document.getElementById(name).dispatchEvent(new Event("tabshow"));
}

tabs.forEach((tab, i) => {
  tab.addEventListener("click", () => show(TABS[i]));
  tab.addEventListener("keydown", (event) => {
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    show(TABS[(to + TABS.length) % TABS.length], true);
  });
});
// An address edited on the open page shows its tab and assumptions (the review of 2 November 2026). The page's own
// changes don't fire this: it rewrites the address with replaceState.
window.addEventListener("hashchange", () => {
  // An unknown tab shows the first, whose calculator rewrites the address (the review of 3 November 2026).
  const asked = new URLSearchParams(location.hash.slice(1)).get("tab") ?? TABS[0];
  const tab = TABS.includes(asked) ? asked : TABS[0];
  readAddress(tab);
  show(tab);
});
show(page.tab);
