# Caspa Repair Work Order

Purpose: make Caspa produce finished writing, restored research workflows, usable outputs, and review-led improvement instead of defaulting to plans.

## Non-negotiables

- Plans are inputs unless the user explicitly asks for a plan.
- Write means write.
- Improve means improve the supplied text.
- Cut means cut, not decorate.
- Research must be visible, sourced where possible, and honest when live search is unavailable.
- Finished artefacts appear before notes.
- No purple prose. No padding.

## Required repair areas

### 1. Intent and output routing

Add strict routing for:

- manuscript drafts
- book plans
- play/script treatments
- research notes
- source material
- command-only inputs
- mixed inputs

If a plan is supplied and the user asks for a chapter, scene, book or play, consume the plan silently and output the requested writing.

If a manuscript is supplied and the user asks for polish, cut, repair or gold pass, output revised text first.

Before returning any plan, check whether the user explicitly requested a plan. If not, block plan output.

### 2. Core commands

Implement or repair:

- `/write-from-plan`
- `/rapid-write`
- `/gold-pass`
- `/red-pen`
- `/cut-pass`
- `/continue`
- `/research-run`
- `/send-to-white-page`
- `/send-to-outputs`

### 3. Manuscript improvement intake

Before major improvement passes, ask the user how the manuscript should be improved.

Collect:

- desired improvement modes
- what the user thinks is wrong
- what must be preserved
- what must be removed
- external reviews, beta-reader notes, editor comments, agent feedback or criticism
- priority mode

Do not run a major rewrite until an improvement brief exists, unless the user selects `Just polish it`.

### 4. Research Desk

Restore a dedicated research room with:

- research question box
- research mode selector
- auto research
- self-guided research
- visible research run log
- findings panel
- source list
- confidence/relevance/writing-use fields
- project research memory
- send to White Page
- send to Outputs

If live web search is unavailable, say so and provide suggested search queries only.

### 5. Outputs Room

Outputs must generate finished deliverables:

- chapter
- scene
- play scene
- script scene
- synopsis
- treatment
- pitch pack
- query letter
- character bible
- research brief
- rehearsal pack
- markdown export
- PDF-ready export

Do not generate advice or another plan unless the selected output type is Plan.

### 6. API orchestration

Single-shot prompting is insufficient.

Add multi-pass orchestration where useful:

1. architect
2. dramaturg/editor
3. voice
4. continuity
5. cut
6. gold
7. judge
8. rewrite once if quality threshold fails

No endless loops.

### 7. Navigation

Target navigation:

MAKE
- New Work

WRITE
- White Page
- Current Project

RESEARCH
- Research Desk
- Source Library
- Research Memory

IMPROVE
- Red Pen
- Gold Pass
- Cut Pass

PRODUCE
- Outputs
- Publish Pack
- Export

Settings remains separate.

## Acceptance tests

1. Manuscript + Gold Pass: asks for improvement intent, accepts reviews, then outputs polished text. Forbidden: book plan.
2. Book plan + Write Chapter One: outputs prose. Forbidden: revised outline.
3. Manuscript + Cut Hard: outputs cut text and deletion log. Forbidden: expansion or purple rewrite.
4. Play treatment + Make the Play: outputs stage script. Forbidden: new treatment.
5. Research Desk + Deep Web Research: shows research run and findings if available, or unavailable status plus suggested queries. Forbidden: generic advice.
6. Research findings + Send to White Page: outputs usable scene/chapter material. Forbidden: research summary only.
7. Manuscript + review saying dialogue strong but pacing slow: preserves dialogue and improves pacing.
8. Outputs + Pitch Pack: outputs actual pitch pack. Forbidden: advice on how to make one.

## Implementation constraints

- Use smallest safe changes.
- Do not break Firebase auth.
- Do not remove current White Page.
- Do not pretend web research happened.
- Preserve direct Caspa tone.
- Treat cutting as valuable creative work.
