# 🎃 Pumpkin Smash

A 60-second Halloween arcade game: pumpkins arc out of the fog, you smash them with a swipe or a click.
Bonus ghosts give **+5 s** or **double points**. Avoid **skull bombs**. At 40 s a **giant pumpkin boss** rises from the fog.

## Start
- Double-click `index.html` (works via `file://`, no server needed), or
- run `start.command` (macOS): it starts `python3 -m http.server` on **port 8801** and opens the browser.

## Controls
- Mouse: click, or hold and drag to swipe. Touch: swipe or tap.
- `Esc` pauses. `Enter` / `Space` starts a round.

## Features
- three.js scene: big moon, purple starry sky, layered ground fog, dead trees, gravestones, flickering lanterns and candles, a jack-o'-lantern field, bats, and lightning with thunder.
- Pumpkins come in three sizes plus tall and golden variants. Big pumpkins crack first and burst on the second hit. Each burst throws chunks, seeds, goo and sliced halves, with a light flash, screen shake and score popups.
- Combos: chained hits give COMBO x2, x3 and so on, with bonus = 10·n·(n−1), escalating stingers and flashes.
- The boss has 36 HP (22 in Kids mode), cracks progressively and roars at half HP. Its finale has slow-mo, a multi-burst explosion and +1000 points.
- End card: score, best score (localStorage), rank title, name field, share text (EN/DE, copied to the clipboard), a 1080×1350 PNG end-card screenshot, and replay.
- Kids mode (Kinder-Modus): cute faces, a sleeping cat instead of skull bombs (−20 instead of −50), a slower pace, a friendlier and weaker boss, softer sounds with no roar.
- UI in English, with a DE toggle. Quality levels: Low/Medium/High/Ultra (DE: Niedrig/Mittel/Hoch/Ultra), auto-chosen from the measured FPS on the first start.
- Audio: real CC0 recordings embedded as base64, with random pitch/volume per play. Separate music and SFX sliders, plus mute. Credits are in `LICENSES/SOUNDS.md`.

## Build (only needed after changing `src/` or `sounds/`)
```
npm install
node tools/build.mjs      # → js/game.bundle.js + js/sounds-src.js
```

## Tests
`python3 test/test_game.py` (Playwright + Chrome with SwiftShader). It writes screenshots to `test/shots/`.
