---
name: grill-me
description: Interview R relentlessly about a plan, feature or plan.md step until every decision behind it is settled, then write the decisions down. Use when R says "grill me", "/grill-me <step>", or asks to be questioned about a design before building it.
---

# Grill me

Question R about the plan or step named in the arguments (e.g. `5.8`) until the two of you share one
picture of what gets built. The aim is to surface every decision R hasn't made yet, not to build.

## Before the first question

1. Find the step: `reference/plan.md`, CLAUDE.md, GLOSSARY.md, `reference/staging/import-report.md`.
2. Read the code and data it touches. **Never ask what the repo can answer**: look it up and state
   it as a fact ("the pins are HTML markers in `MapView.tsx`, so MapLibre's label collision doesn't
   see them").
3. Check what CLAUDE.md already decides. Don't re-ask a settled rule; do flag a rule that the step
   would contradict, or that turns out vague once you try to build it.
4. Sketch the design tree: the decisions, and which ones depend on which. Ask parents before
   children (no point choosing a badge colour before knowing groups exist at that zoom).

## Asking

- One decision per question. Each question says why it matters (the case that breaks if it's left
  open), using a real place, date or zoom level from `data/` where possible.
- Give your recommended answer first, marked "(Recommended)", with the reason. R wants honest
  evaluation: say so when an option R floated is a bad idea.
- Use AskUserQuestion. Up to 3–4 questions per round, but only ones that don't depend on each
  other's answers. Then read the answers, update the tree, and go down the next level.
- Decide technical internals yourself (library calls, file layout, naming) unless they change
  behaviour R would see, cost money, add a data source, or touch the schema or bloom scale
  (CLAUDE.md: ask first for those). Mention what you decided in one line.
- Keep pushing: edge cases (empty data, the selected place, filters, language, debug date, phones),
  interactions with earlier steps, and "can this be explained in one sentence?" (CLAUDE.md's
  complexity test). If a rule fails that test, say so and propose a simpler one.
- Stop when every branch is answered or explicitly parked. Don't pad with questions you'd answer
  the same way R would.

## When done

1. Summarise the decisions as short rules, plus anything parked.
2. Write them down where they belong: rules into CLAUDE.md (the source of truth), the reasoning and
   parked items into `reference/plan.md` under the step, new terms into GLOSSARY.md. Show R the
   wording and get a yes before editing CLAUDE.md.
3. Ask whether to start building. Don't start without that yes.
