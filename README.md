# TaskFlow Pro

A premium, dark-mode Kanban task board built with **zero frameworks** — just semantic HTML, modern CSS, and vanilla JavaScript. Inspired by the visual language of Linear, Notion, and Stripe Dashboard.

![Tech](https://img.shields.io/badge/stack-HTML%20%7C%20CSS%20%7C%20JS-4F46E5)

## Features

- **Drag-and-drop board** across four columns (Backlog, To Do, In Progress, Done) using the native HTML5 Drag & Drop API — no libraries
- **Full task CRUD**: create, edit, and delete tasks with a confirmation step before deletion
- **Live dashboard**: total tasks, completed, pending, and completion-rate progress bar, all recalculated on every change
- **Search** across task titles and descriptions, debounced for performance
- **Filtering** by priority and category, combinable with search
- **Persistent storage**: everything is saved to `localStorage` and restored on reload
- **Toast notifications** for create/update/delete/move actions
- **Keyboard accessible**: focus-visible states, focus trapping in modals, Enter/Space/Delete on cards, Esc to close dialogs
- **Fully responsive**: desktop, tablet, and mobile layouts

## Project structure

```
taskflow-pro/
├── index.html      # Markup: topbar, dashboard, board, modals
├── styles.css       # Design tokens, components, responsive rules
├── app.js           # State, rendering, drag & drop, storage, events
└── README.md
```

## Running locally

No build step required. Either:

1. Open `index.html` directly in a browser, or
2. Serve it locally for a cleaner dev loop:
   ```bash
   python3 -m http.server 8080
   # then visit http://localhost:8080
   ```

## How it's built

**State management** lives in a single `state` object in `app.js` (tasks array + active filters). Every mutation goes through a small set of functions (`addTask`, `updateTask`, `deleteTask`, `moveTask`), each of which calls `saveTasks()` to persist to `localStorage`, followed by a full `render()` that rebuilds the board from current state. This one-directional flow (mutate state → save → re-render) keeps the UI and storage from ever drifting apart.

**Drag and drop** uses the native HTML5 API: each task card is `draggable="true"` and fires `dragstart`/`dragend`; each column list listens for `dragover`, `dragleave`, and `drop`. On drop, the task's `status` is updated in state and the board re-renders.

**Styling** is driven by CSS custom properties (`:root` tokens for color, radius, shadow, motion) so the whole theme can be reskinned by editing one block at the top of `styles.css`.

## Deploying to GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repo, go to **Settings → Pages**.
3. Under "Build and deployment", set **Source** to `Deploy from a branch`.
4. Choose the `main` branch and `/ (root)` folder, then save.
5. GitHub will publish the site at `https://<your-username>.github.io/<repo-name>/` within a minute or two.

No build tools, bundlers, or config files are needed since this is plain static HTML/CSS/JS.
