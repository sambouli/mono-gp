# MONO GRAND PRIX

A retro monochrome first-person racer for mobile browsers. One file, zero
dependencies, zero assets — everything (graphics, font, sound) is synthesized
at runtime from canvas primitives and WebAudio.

**Play:** open [`index.html`](index.html) on a phone (or desktop). That is the
whole game — 81 KB, no network access, works offline.

## The game

- **Qualifying:** one 75-second session; your best lap sets your grid slot
  against six AI rivals with simulated pace sheets.
- **Race:** 5 laps off a rolling start, live position, lap/last/best timing,
  classified finish screen.
- **Track:** one ~30-second lap (Monaco-ish) — long right sweeper, esses over
  a crest, fast left, descent into the bowl — run in and out seamlessly.
- **Controls:** drag or turn the steering wheel (bottom-left); GAS and BRAKE
  pads on the right. Keyboard on desktop: arrows/WASD, Space, P pause, M mute.
- **Collisions:** kerb-side hazards spin you down, contact with rivals costs
  speed for both; run-off areas punish but don't kill.

## The look

OutRun-style pseudo-3D (segment projection) rendered into a low-resolution
offscreen buffer, then quantised through an 8x8 Bayer ordered-dither pass to a
4-level green-LCD palette and upscaled with nearest-neighbour. Scanlines,
vignette and bloom are CSS overlays. The HUD uses a bitmap font drawn on a
separate crisp layer so text stays legible over chunky pixels.

## Development

The single file is assembled from numbered parts so every edit is syntax-gated:

```
src/NN-name.js   engine parts (config, track, cars, sim, post, render,
                 sprites, font, layout, HUD, cockpit, audio, boot)
build.js         concat + V8 parse gate; refuses to emit an unparsable game
test/sim.js      79 headless tests driving the SHIPPING code from index.html
                 (track integrity, bot lap times, quali/race flow, collisions,
                 determinism, HUD rect disjointness across aspect ratios)
```

```sh
node build.js      # -> index.html
node test/sim.js   # -> ALL PASS 79/79
```

MIT.
