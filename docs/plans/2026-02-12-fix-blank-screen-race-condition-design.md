# Fix: Blank Screen on First Load (Race Condition)

**Date:** 2026-02-12
**Branch:** fix/ui

## Problem

The app sometimes shows a blank screen on the first load. Subsequent loads work fine.

**Root cause:** A race condition between the Rust backend and JS frontend during initialization.

- `main.rs:96-99` spawns a thread with a hardcoded 100ms delay, then emits an `app-init` event
- `main.js:432` registers the `app-init` listener only after DOM init, Tauri API checks, and close protection setup
- If the frontend takes >100ms to reach listener registration (common on cold starts), the event fires before anyone is listening
- Tauri does not queue missed events — the file never loads, resulting in a blank screen

## Approach: Frontend-Driven Init

Replace the push-based event model with a pull-based command model. The frontend requests init state when it's ready, eliminating the race entirely.

## Changes

### Backend (`src-tauri/src/main.rs`)

**Remove:**
- `std::thread::spawn` + `sleep(100ms)` + `emit("app-init", ...)` (lines 93-99)
- `use tauri::Emitter` import (if no longer needed)

**Add:**
- Store `AppInit` in Tauri's managed state via `.manage(init_state)`
- New `get_init_state` command that returns the managed `AppInit` state

### Backend (`src-tauri/src/commands.rs`)

**Add:**
- `get_init_state` Tauri command that reads from managed state and returns `AppInit`

### Frontend (`src/main.js`)

**Remove:**
- `await listen('app-init', async (event) => { ... })` block

**Replace with:**
- `const initState = await invoke('get_init_state')` — direct pull when frontend is ready
- Same downstream logic (apply theme, load file, set edit mode)

## Why This Works

- Zero race conditions: the frontend only calls the backend when it's fully initialized
- Simpler code: no thread spawn, no sleep, no event emission
- Deterministic: same behavior on cold and warm starts
