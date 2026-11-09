# Just Us · Couples Cards

A mobile-first browser card game for couples. Tap the deck (top left) to draw a card; pick the spicy level (top right): **Normal**, **A bit spicy**, **Spicy**. Every card shows the question in English and Brazilian Portuguese.

- 50 questions per level, edit them in `questions.js`.
- Each level's deck is shuffled with no repeats; it reshuffles automatically when all cards are used. Progress is remembered on the device.
- No build step: open `index.html`, or host the folder on any static host (e.g. GitHub Pages). It can be added to the phone's home screen to play full-screen.

Run locally:

```sh
python3 -m http.server 8000
# then open http://localhost:8000 (or http://<your-computer-ip>:8000 on your phone)
```

---

# Quem Bebe? · Who Drinks? (couples quiz drinking game)

A separate game in the [`quem-bebe/`](quem-bebe/) folder: open `quem-bebe/index.html` (or `http://localhost:8000/quem-bebe/` with the server above).

- Enter both players' names, then take turns (P1, P2, P1, P2, P1, P2). Each player answers 3 questions per round.
- On your turn, tap a category deck. You can't use the same category twice in one round, as long as there are at least 3 categories.
- Tap an answer and you see straight away if it's right (+1 point) or wrong (0 points).
- After each round, whoever scored fewer points in that round drinks. On a tie, both drink.
- Every question and answer is shown in English and Brazilian Portuguese. The game is saved on the device, so a reload resumes it.

**Adding questions:** add or edit a `.txt` file in `quem-bebe/questions-src/`, one file per category, in the same format as `geography.txt`. The first line is `Category: English / Português / emoji`. Then run:

```sh
python3 quem-bebe/tools/build_questions.py
```

This regenerates `quem-bebe/questions.js`. It also checks every answer-key entry against its option text.
