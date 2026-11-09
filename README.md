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
