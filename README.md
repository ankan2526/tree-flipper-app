# Tree Flipper

Tree Flipper is a small Expo puzzle game. Tap a node to flip that node and every
node below it, then match the target tree. Each level also includes three special
moves that flip a single node without changing its descendants.

## Run the app

```bash
npm install
npx expo start
```

Open the app in Expo Go, an iOS simulator, or an Android emulator.

## Project layout

- `src/app/` contains the Expo Router routes.
- `src/screens/` contains the home, game, and level-builder screens.
- `src/data/levels.js` contains the built-in level trees.
- `src/utils/gameLogic.js` contains the pure tree operations.
- `src/utils/storage.js` persists completed level IDs with AsyncStorage.

Use the Developer: Level Builder button on the home screen to create and copy
JSON for an additional level.

Levels are grouped into chapters using `src/data/chapters.json`. Chapter 1,
“Roots of Reason,” uses the standard rules. Chapter 2, “Branches Under
Pressure,” gives each level a move limit; special moves count toward that
limit, and a level can be retried if the moves run out. The home screen
provides chapter tabs and opens on the chapter with the next unlocked,
unfinished level. Completing a chapter’s final level shows a congratulations
screen before offering to continue into the next chapter.

## Manage levels with the local UI

From the project directory, run:

```bash
npm run manage-levels
```

Open the printed `http://127.0.0.1:4173` address in your browser. This
standalone local-only interface matches the app’s light green-and-white theme
and renders each level as a clickable tree. Select a node to edit its ID or
target color, add a child, or remove it; the same interface creates, edits, and
deletes levels. Select a chapter when creating or editing a level; chapters
with limited moves require a per-level move limit. Changes are validated and written directly to
`src/data/levels.js`; the manager uses only Node.js built-ins and is not
included in the Expo app. Stop it with Ctrl+C when finished.

Run the non-destructive tests with:

```bash
npm run test:level-manager
```
