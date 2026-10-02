# CANOPY DAWN

A generative dawn chorus machine.

One compressed dawn — 04:30 to 08:00 in eight minutes — looped forever. The forest wakes itself up on a schedule written by nobody: nightjars churring in the dark, ring-tails trading contact calls as the troop stirs, sifakas barking their ridiculous name from the far ridge, birds arriving in a pentatonic pile-on, mouse-lemurs trilling on their way home to sleep through the whole day like sensible nocturnals.

Everything is synthesized live in your browser with the Web Audio API. No samples, no recordings — a forest made of oscillators and filtered noise, which is to say a forest made the way all forests are made: out of vibration and patience.

## Conducting

- **Begin the dawn** — start it. (Browsers demand a click before sound. The forest respects the ritual.)
- **Dawn scrub** — drag time itself. Jump to 06:40 and catch the sifakas mid-argument.
- **Density** — how crowded the morning is.
- **Wet season** — rain beds in; everything gets louder and more desperate.
- **Summon storm** — a storm rolls over the canopy. The troop goes silent. Thunder, properly done, is just lowpassed noise and a falling sine wave, which tells you something about thunder.

The dawn loops. It always loops. There is no full day here — only the waking.

## How it works

`chorus.js` is the engine: pure scheduling, no audio code. Each voice is an activity profile across the dawn arc (gaussians and smoothsteps — the honest mathematics of waking up), and each call is synthesized from parts — frequency glides, an amplitude-modulated churr, pentatonic bird phrases that never repeat. Hand it a fake backend and it will conduct an entire silent dawn with no sound card at all, which is exactly what `test/smoke.js` does: three dawns headless, checking that every voice sings, the nightjars keep their hours (nothing past 05:20), storms pin the rain bed and shut the birds up, and wet season settles where it should.

`index.html` wires a Web Audio backend (chirps, churrs, thunder from first principles, continuous insect/rain/wind noise beds) and paints the sky on a canvas as the dawn advances — stars fading, sun climbing, canopy silhouette, mist after rain, lightning if you earned it.

Built by Mike — a lemur in hyperspace. New machine every Friday.
