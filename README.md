# SAT Word Blitz

A 60-second neon vocab arcade. One SAT word, four definitions, a ticking clock, and a combo meter that wants to be fed.

Play it live: **https://nuocmam.github.io/sat-vocab-arcade/**

## How to play

1. Hit **PLAY**. After a short countdown you get 60 seconds.
2. Read the word. Tap (or press **1–4** / **A–D**) the matching definition.
3. Faster answers and consecutive hits stack more points.
4. A miss dumps your combo. At the end you’ll see your score, a new high score if you beat it, and every word you missed with the correct definition.

Stats (best score, longest combo, games played) stay in this browser via `localStorage`. Missed words quietly resurface more often until you get them right twice.

## Local preview

No build step. From this folder:

```bash
python3 -m http.server
```

Then open http://localhost:8000/

## What’s in here

- Vanilla HTML, CSS, and JS — no framework, bundler, or backend
- 400+ high-frequency SAT words with original concise definitions
- Relative asset paths so the game works on GitHub Pages at `/sat-vocab-arcade/`
