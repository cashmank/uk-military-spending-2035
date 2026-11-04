# UK military spending to 2035

Two interactive charts on one page, published at https://cashmank.github.io/uk-military-spending-2035/:

- **Historical spending:** UK military spending in real terms, 1950/51–2035/36, against its Cold War peak, on NATO figures or adjusted to SIPRI definitions.
- **Extra spending:** how much more the UK would spend on the military to reach 3% or 3.5% of GDP, against a baseline.

Each tab's assumptions can be changed, and the page keeps them in its address, so any view can be linked to. Charts by the Transition Security Project.

## This repository is a published copy

It holds only the website, copied from the author's working folder each time the site is updated. Each update replaces everything here, so a change made in this repository, a merged pull request included, would be overwritten. To make a version of your own, fork or clone it and host your copy wherever you like.

The data and the calculation are built and tested outside this repository, from the sources below; it holds their results.

## Viewing it on your own computer

There is nothing to build or install. The page loads its data with a request to its own folder, which browsers block for a file opened from disk, so it needs a web server. From this folder:

    python -m http.server 8000

(on Windows, `py -m http.server 8000`), then open http://localhost:8000/. Any static web server or host will serve it as it is. On GitHub Pages, keep the empty `.nojekyll` file, which tells GitHub to serve the files unchanged.

## What is where

| File | What it does |
|---|---|
| `index.html` | The page: the two tabs and the places the scripts fill in |
| `css/style.css` | The page's look: fonts, colours, spacing, the tabs, the option buttons and the boxes. The page is 760px wide on every screen; phones zoom and pan |
| `js/ui.js` | What both tabs share: the option controls, the selections kept in the address, the CSV download, number formats, and the charts' palette (`DW`) and Highcharts defaults (`highchartsDefaults`) |
| `js/historical.js`, `js/extra-spending.js` | Each tab: its choices (the `GROUPS` list near the top), its words and its chart |
| `js/tabs.js` | Switching between the tabs |
| `js/data.js` | Loads the data once for both tabs, and shows a message instead of the charts if anything fails before they draw |
| `js/model.js` | The calculation |
| `data/model_inputs.json` | The data the calculation uses |
| `fonts/` | Roboto, with its licence |

## Making changes

- **Styling:** `css/style.css` for the page; `DW` and `highchartsDefaults` in `js/ui.js` for the charts; each tab's script for its own chart's lines, labels and shaded bands.
- **Controls:** each choice is a key, a label and its options in its tab's `GROUPS` list. `renderGroups` in `js/ui.js` draws every choice as a row of buttons (radio inputs styled as a segmented control). To show a choice as a dropdown, change how `renderGroups` draws it, and `applyShared`, `relabel` and `refresh`, which work on the buttons. The address records each choice by its key and option value, so links keep working while those stay the same.
- **Wording:** in the two tab scripts and `index.html`.
- **The figures:** `js/model.js` and `data/model_inputs.json` come from the author's build, which checks the calculation case by case against a separate Python implementation, and the data file is replaced at every data update. Change them only if you mean to change the figures.

## Sources

NATO, SIPRI, the MOD, HM Treasury, the OBR and the ONS, as each chart's notes and source line set out, with the date of the data. Keep them with any copy.

## Highcharts

The charts use Highcharts 11.4.8, loaded from jsDelivr, under a licence held by Common Wealth. Highcharts is commercial software, so a copy hosted by anyone else needs its own Highcharts licence: see https://www.highcharts.com/license.
