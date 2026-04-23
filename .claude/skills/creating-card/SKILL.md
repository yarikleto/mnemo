---
name: creating-card
description: Use when the user asks you to create a mnemo flashcard (or a batch of them), turn a topic / conversation / document into cards, or author a `.md` card file for this Electron app. Also use when someone says "make me a card about X" and expects a polished prompt + answer written to disk.
---

# Creating a mnemo card

## What a card is

One `.md` file under `<rootPath>/cards/<namespace>/<slug>.md` with YAML frontmatter + a markdown body. The app's file watcher auto-indexes new files — no app restart, no IPC. That means **the skill is just: write a well-formed `.md` file into the right place, and the card exists.**

Schema (enforced by `src/shared/schema.ts`, `CardFrontmatterSchema`):

- `id` — ULID, 26 chars, Crockford base32. Must be unique across the whole store.
- `prompts` — non-empty array of `{ id: ULID, text: string }`. Each entry is a *variant* of the card's front: the review UI picks one to show, they all resolve to the same answer body. Use one prompt by default; add more only when you want to drill the same fact from multiple angles.
- `tags` — array of strings (can be empty).
- `created` — ISO 8601 datetime (`2026-04-23T13:33:54.725Z`).

Body is any markdown. It's the back of the card — shown after the user rates their recall.

## The mechanical part: use the helper script

Don't hand-roll ULIDs or frontmatter. The script handles root discovery, ULID, slug, atomic write, and matches the exact format `src/main/markdown/parse.ts` expects:

```bash
./tools/authoring/create-card.mjs \
  --namespace "algorithms/graphs" \
  --prompt "What does BFS guarantee on an unweighted graph?" \
  --tags "algorithms,graphs,bfs" \
  --body-file /tmp/body.md
```

`--prompt` is repeatable. Pass it more than once to attach phrasing variants to the same card:

```bash
./tools/authoring/create-card.mjs \
  --namespace "system-design/caching" \
  --prompt "Why is write-through slower than write-back on hot writes?" \
  --prompt "On a hot key, which caching policy issues more backing-store writes, and why?" \
  --body-file /tmp/body.md
```

Body input — pick whichever fits: `--body-file <path>`, `--body "<inline>"`, or pipe on stdin. Pass `--dry-run` to preview without writing. The script prints the absolute file path on success. Run with `--help` for the full flag list.

Root discovery: reads `rootPath` from the live `config.json` that Electron writes (on macOS: `~/Library/Application Support/mnemo/config.json`). Override with `--root <path>` if you need to target a different store (e.g. a test fixture).

Creating many cards: call the script once per card. Don't write a wrapper that tries to batch — one-per-card keeps slugs, ULIDs, and error handling clean.

## The judgment part: what makes a *good* card

This is where the LLM earns its keep. The script guarantees the file is valid; you are responsible for the card being *learnable*.

### Prompts (front)

Every card has at least one prompt. A second or third prompt is a *rephrasing of the same question* — not a follow-up, not a related fact. All variants resolve to the same answer body, so if two phrasings wouldn't share an answer they should be two separate cards.

- **One idea per card.** If the answer has multiple parts, split it into multiple cards.
- **Specific, not generic.** "What is a B-tree?" is weak — the answer could be a paragraph or a book. "Why do B-trees use high branching factors?" forces one focused answer.
- **Context-free.** The prompt must stand alone. No "in the previous card…", no pronouns pointing nowhere. Someone seeing this card in 6 months, out of order, should know exactly what's being asked.
- **Active recall, not recognition.** Avoid yes/no or multiple-choice phrasing. Ask for a reason, a mechanism, a value, a steps-list.
- **Plain text, ~120 chars.** It appears in the review UI on one line. If a prompt *needs* markdown (a snippet, a formula), it's usually two cards: one prose prompt, one "complete this code" card.
- **Use extra prompts sparingly.** Default to one. Add a second variant only when the concept is worth drilling from two distinct angles (e.g., forward and reverse direction of a definition), and each variant still stands alone under the rules above.

### Body (back)

- **Lead with the answer in one sentence.** The first line is what the learner sees first. Put the key fact there. Elaboration follows.
- **Then the *why*, briefly.** A mechanism, a worked example, an intuition. 2–5 sentences is the sweet spot. Longer bodies become re-reading, not recall.
- **Use markdown deliberately:**
  - Code blocks with language tag (` ```ts `) for anything that's code.
  - Inline code for identifiers, shell flags, file paths.
  - **Bold** for the single most important term. Don't scatter.
  - Bullet lists for genuinely parallel items (3–6 bullets). Prose is better for a narrative answer.
  - Math: inline `\(…\)`, block `$$…$$` — the renderer handles KaTeX.
  - A single image is fine if it clarifies (diagram, screenshot). Reference it with a relative path or an absolute URL.
- **No meta.** Don't write "This card is about…", "As we saw…", "The answer is…". Just state the thing.
- **No references to other cards.** Cards get reordered by FSRS; "see card X" goes stale.

### Namespace

The folder under `cards/` *is* the namespace — it shows up in namespace-ranking widgets, filtering, and stats. Use it like a topic hierarchy, `lowercase-with-hyphens`, `/`-separated.

- Good: `algorithms/graphs`, `system-design/caching`, `french/vocabulary`, `company/wix/ravenpack`
- Bad: `misc`, `stuff`, `new-cards-2026`, `Algorithms/Graphs` (mixed case causes path-casing bugs on case-insensitive filesystems)

When in doubt, pick the narrowest topical folder that'll still have ≥5 cards in it. You can move cards later with the app's Browse UI — don't optimize for permanence.

### Tags

Orthogonal to namespace. Use them for cross-cutting attributes the folder can't express: difficulty (`hard`), source (`clrs`, `leetcode-42`), review purpose (`interview-prep`), type (`definition`, `tradeoff`, `syntax`). Lowercase, hyphenated, no spaces.

## Worked example

Good card (`cards/system-design/caching/why-write-through-is-slower-than-write-back.md`):

```markdown
---
id: 01KPX8RQK2WVTQW0ANJXJ8FM8Q
prompts:
  - id: 01KPX8RQK3A7NE6YH4N8C0JDPK
    text: 'Why is write-through caching slower than write-back on hot writes?'
tags:
  - 'system-design'
  - 'caching'
  - 'tradeoff'
created: '2026-04-23T13:34:14.626Z'
---

**Write-through** pays the backing-store latency on every write; **write-back** only pays it when a dirty line is evicted.

A hot key hit 1000×/sec under write-through issues 1000 sync writes to the slow store. Under write-back, those coalesce in the cache and flush as one eviction — O(evictions) disk IO, not O(writes). The trade: write-back loses un-flushed writes on crash, so durability-critical systems pick write-through anyway.
```

What makes it work: prompt is specific and asks *why* (forces a mechanism answer); first sentence of the body is the whole answer in compressed form; second paragraph is the intuition + the tradeoff; no meta, no filler; markdown is used exactly twice (bold on the two key terms).

## Common mistakes

- **Editing an existing card's `id`, prompt `id`s, `created`, or file path by hand.** The card `id` is a primary key; each prompt `id` is referenced by FSRS review state; `created` is used for stats; the path encodes the namespace. Change prompt `text` or body freely — leave identity alone. To move a card, use the app's Browse → Move UI (it handles the rename + index update atomically).
- **Writing to `state/`.** That's FSRS-owned data keyed by card `id`. Never create or edit those files.
- **Non-ISO `created` timestamps.** Zod rejects the card and the watcher silently skips it. The script formats this correctly — don't override it.
- **ULID collisions from copy-paste.** If you're tempted to duplicate a card by copying the file, *don't*. Run the script twice. Two cards must never share an `id`.
- **Bloated body.** If the back is longer than the front of a typical textbook section, you're rebuilding the textbook. Split into smaller cards or cut it.
- **Question that re-states the topic.** "Explain quicksort." → too broad. "Why is quicksort's worst case O(n²), and what input triggers it?" → a card.

## When NOT to use this skill

- The user wants to *edit* an existing card — use the app's Browse/Edit UI or edit the `.md` file directly; don't create a new one.
- The user wants to bulk-import from Anki / CSV — that's a different problem (mapping, deduplication, preserving review state). Ask first.
- The user is asking about the app's code (how the IPC works, adding a widget, etc.) — that's a regular coding task, not this skill.
