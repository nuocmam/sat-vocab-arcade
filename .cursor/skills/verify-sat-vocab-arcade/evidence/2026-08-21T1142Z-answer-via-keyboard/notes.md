# Proof: answer via keyboard

Feature file: `features/answer-via-keyboard.md`

## Actions

1. `launch.sh` — HTTP + Chrome CDP
2. `doctor.sh` — read-only health
3. `drive.mjs clear-storage` — empty `satWordBlitz.v1`
4. `drive.mjs click-play` then `wait-countdown` then `wait-playing`
5. `drive.mjs key-correct` — press the 1–4 key for the right definition

## Observed

- Home BEST/MAX COMBO/RUNS: 0/0/0
- First word: `meticulous` with 4 choices
- Key pressed: `2` for `showing extreme care about small details`
- After key: score=122 combo=x1 correct_class=True
- Next word: `perfidious` (was `meticulous`)

## Pass checks

- PASS: home screen before PLAY
- PASS: question showing after countdown
- PASS: four definition buttons
- PASS: score increased after correct key
- PASS: combo is x1 after first hit
- PASS: .choice.correct present immediately after the key
- PASS: next question replaced the word
