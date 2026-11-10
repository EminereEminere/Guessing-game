# Just Us · Couples Cards

A mobile-first browser card game for couples. Tap the deck (top left) to draw a card.

- **Packs** (tap the title at the top): Questions, Dares, How Well Do You Know Me?, Deep Talk, Long-Distance.
- **Levels** (top right): Normal / A bit spicy / Spicy — Deep Talk uses Levels 1–3. Level 2 brings embers, level 3 sets the screen (and the card) on fire; Deep Talk gets a candle glow that grows with the level.
- **Languages:** chosen on first launch — English, Português (Brasil) or bilingual. Change it any time in the ⋯ menu.
- **Players & skips:** optional names; turns alternate every card. Each player has 5 skips per game — skip a card and you drink instead. "New game" in the menu resets skips and scores.
- **How Well Do You Know Me?:** mark each guess ✓ or ✗ to keep score.
- **Timers:** cards that mention a duration (e.g. "30 seconds") get a ▶ timer button.
- **Two phones:** in the menu, "Play on two phones" — both enter the same code and draw the same cards in the same order (great for Long-Distance video calls).
- **Share:** the share button sends the game link to your partner.

Card text lives in `data/*.js` (each card is `[English, Português]`). No build step: host the folder on any static host (e.g. GitHub Pages) or run locally:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```
