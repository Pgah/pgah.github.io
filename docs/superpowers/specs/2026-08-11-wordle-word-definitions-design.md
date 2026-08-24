# Wordle Word Definitions — Design Spec

**Date:** 2026-08-11  
**Status:** Approved

---

## Goal

When a player finishes a Wordle game (win or loss), show the English definition of that day's word in a distinct card below the result message.

---

## Data Layer — `src/lib/wordle.ts`

Add a `DEFINITIONS` record mapping every word in `WORDS` to a short English definition (1–2 sentences). Export a helper:

```ts
export const DEFINITIONS: Readonly<Record<string, string>> = { ... };

export function getDefinition(word: string): string | null {
  return DEFINITIONS[word.toUpperCase()] ?? null;
}
```

- Keys are uppercase to match `WORDS` convention.
- If a word has no entry, `getDefinition` returns `null` and no card is shown.

---

## UI — `src/pages/wordle.astro`

### DOM element

Add a hidden `<div class="wl-definition" id="definition" hidden>` between `.wl-msg` and `.wl-keyboard`:

```html
<div class="wl-definition" id="definition" hidden>
  <strong class="wl-def-word"></strong>
  <span class="wl-def-text"></span>
</div>
```

### Logic

`finishGame(won: boolean)` is extended to call `showDefinition()` after setting the result message.

```ts
function showDefinition(): void {
  const def = getDefinition(target);
  if (!def) return;
  const el = document.getElementById('definition')!;
  el.querySelector('.wl-def-word')!.textContent = target;
  el.querySelector('.wl-def-text')!.textContent = def;
  el.hidden = false;
}
```

### Styling

```css
.wl-definition {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  border: 1px solid var(--fg-muted);
  padding: 0.75rem 1.25rem;
  max-width: 28rem;
  width: 100%;
}
.wl-def-word {
  color: var(--fg-bright);
  font-size: 1rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}
.wl-def-text {
  color: var(--fg-dim);
  font-size: 0.85rem;
  line-height: 1.5;
}
```

---

## Scope

- Definitions cover all 365 words in `WORDS`.
- No external API calls — all definitions are bundled at build time.
- Definition card is shown on both win and loss.
- Restored games (page reload after finishing) also show the definition via the existing `restore()` path, since `restore()` calls `finishGame()`.

---

## Out of Scope

- Definitions in Turkish.
- Clickable links or "learn more" flows.
- Showing definitions mid-game or as hints.
