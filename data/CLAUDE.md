# CLAUDE.md: data chat (Haiku)

This chat is for **editing the data files in `data/`** (YAML and CSV) for the Ibaraki Flora Map. It runs on Haiku on purpose, to save usage on the higher models. Keep work here to data entry and data fixes.

The project-wide rules are in the root `CLAUDE.md` (`C:\Users\Reid\Documents\Flora Map\CLAUDE.md`). Read its **Data rules** and **Source and legal rules** sections before a first edit. This file only adds what is specific to this chat.

## What belongs in this chat

- Adding or correcting places, plantings, illuminations, editions, festivals, closures and sources in `data/`.
- Appending rows to `statuses.csv` and `closures.csv`.
- Ticking off items in `reference/staging/import-report.md` as data is fixed.
- Adding glossary terms to `GLOSSARY.md` when a data term needs one.

## What does not belong here (use a higher-model chat)

- Changes to code, schema, or build scripts: `src/`, `scripts/`, `src/lib/schema.ts`, and the status or pin logic in `src/lib/status.ts`.
- Changing the bloom scale, the schema, or renaming IDs (these need R's approval, per the root `CLAUDE.md`).
- Adding a new data source, or a paid service.
- Anything that needs a design decision. If a rule can't be applied to the data as written, stop and tell R.

If a request is in that list, say so in one line and suggest R open a different chat.

## Editing rules

- **Never invent values.** No dates, hours, fees, coordinates, or photo credits. If a value is uncertain, leave the field empty and add an item to `reference/staging/import-report.md`.
- **IDs are permanent.** Never rename an ID that is live. Place IDs must be unique across all prefectures.
- **Folders must match the file.** `data/places/<prefecture>/<municipality>/` uses romaji slugs; the Japanese name goes inside the file (`municipality: 水戸市`).
- **Append-only files:** `data/statuses.csv` and `data/closures.csv`. Add rows at the end. Never edit or delete an existing row.
- **Private fields** (`editor_notes`, `checked_against`, `window_raw`) stay in the files for R. Never copy them into any other field.
- **X and Instagram rows:** store the post ID, post time and derived level only. `raw_text` stays empty.
- **Photos** need `credit` and `license`. Never add a photo without them.
- **Dates** are ISO (`2027-02-22`), Japan time. Every YAML file keeps its `schema_version`.
- **Empty optional fields** are fine: leave them out rather than writing "unknown".
- **Sources:** do not invent source URLs. Skip a source that has no URL and list it in the import report.
- **Converted bloom windows** get `provisional: true` until checked against past data.
- **Do not edit** `reference/staging/draft-list.xlsx`, `reference/staging/draft-list-clean.xlsx`, or `reference/prototype.html`. They are archives.

## Checks: run after every edit

Run both from the project root (`C:\Users\Reid\Documents\Flora Map`):

```powershell
npm run check-data
npm test
```

- `npm run check-data` validates `data/` against the zod schema and cross-checks IDs, references, folders and date ranges.
- `npm test` runs the Vitest suite, including the status-logic tests.

If either fails, fix the data it points to and run both again. If the failure is in the schema, the script, or a test rather than the data, stop and report it to R. Do not change the code here. Report the actual output; do not say the checks pass unless they did.

## Working style

- R prefers direct, precise answers. Say plainly when a data item looks wrong.
- Keep each edit small and describe it in the reply: which file, which ID, what changed.
- R checks sources by hand. Give R the source URL and the exact value you entered, so R can confirm it quickly.
- Do not commit unless R asks. Do not push.
