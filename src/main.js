// Markdown Viewer - Frontend Logic

// Application state
const state = {
  filePath: null,
  filename: 'No file loaded',
  originalContent: '',
  currentContent: '',
  isEditMode: false,
  isDirty: false,
  theme: 'dark',
};

// Debounce utility for live preview
function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

// DOM Elements (initialized after DOM ready)
let elements = {};

// Tauri APIs (initialized after Tauri is ready)
let invoke, listen, appWindow;

// SVG icon paths
const icons = {
  pencil: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z',
  eye: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  moon: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z',
  sun: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
};

function setIconPath(button, pathData) {
  const path = button.querySelector('.icon path');
  if (path) {
    path.setAttribute('d', pathData);
  }
}

// Theme management
function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);

  // Update theme button icon (show sun in dark mode, moon in light mode)
  if (elements.toggleTheme) {
    setIconPath(elements.toggleTheme, theme === 'dark' ? icons.sun : icons.moon);
  }
}

function toggleTheme() {
  const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme);
}

// Edit/Preview mode management
function setEditMode(editMode) {
  state.isEditMode = editMode;

  if (editMode) {
    elements.preview.hidden = true;
    elements.editor.hidden = false;
    elements.editor.value = state.currentContent;
    elements.editor.focus();
    setIconPath(elements.toggleMode, icons.eye);
    elements.toggleMode.title = 'Toggle to Preview (Cmd+E)';
  } else {
    elements.editor.hidden = true;
    elements.preview.hidden = false;
    setIconPath(elements.toggleMode, icons.pencil);
    elements.toggleMode.title = 'Toggle to Edit (Cmd+E)';

    // Always re-render preview to ensure it's in sync with editor
    renderPreview();
  }
}

async function renderPreview() {
  if (!state.currentContent) {
    const message = state.filePath
      ? 'No file loaded. Open a markdown file to get started.'
      : 'Start typing in edit mode...';
    elements.preview.innerHTML = `<p class="empty-state">${message}</p>`;
    return;
  }

  try {
    const html = await invoke('render_markdown', { content: state.currentContent });
    elements.preview.innerHTML = html;
  } catch (error) {
    console.error('Failed to render markdown:', error);
    elements.preview.innerHTML = `<p class="empty-state">Error rendering markdown: ${error}</p>`;
  }
}

// Dirty state management
function updateDirtyState() {
  state.isDirty = state.currentContent !== state.originalContent;
  elements.dirtyIndicator.hidden = !state.isDirty;

  // Update window title
  const title = state.isDirty ? `${state.filename} ●` : state.filename;
  if (appWindow) {
    appWindow.setTitle(title).catch(console.error);
  }
}

// File operations
async function loadFile(path) {
  try {
    const result = await invoke('load_file', { path });

    state.filePath = result.path;
    state.filename = result.filename;
    state.originalContent = result.content;
    state.currentContent = result.content;
    state.isDirty = false;

    elements.filename.textContent = result.filename;
    elements.dirtyIndicator.hidden = true;
    elements.preview.innerHTML = result.html;
    elements.editor.value = result.content;

    if (appWindow) {
      appWindow.setTitle(result.filename).catch(console.error);
    }
  } catch (error) {
    console.error('Failed to load file:', error);
    elements.preview.innerHTML = `<p class="empty-state">Error loading file: ${error}</p>`;
  }
}

async function saveFileAs() {
  const dialog = window.__TAURI__?.dialog;
  if (!dialog?.save) {
    alert('Save dialog not available');
    return null;
  }

  try {
    const path = await dialog.save({
      defaultPath: 'untitled.md',
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    });

    if (path) {
      state.filePath = path;
      state.filename = path.split('/').pop();
      elements.filename.textContent = state.filename;
    }
    return path;
  } catch (error) {
    console.error('Failed to open save dialog:', error);
    return null;
  }
}

async function saveFile() {
  if (!state.isDirty && state.filePath) return;

  // If no file path, prompt user for save location
  if (!state.filePath) {
    const path = await saveFileAs();
    if (!path) return;  // User cancelled
  }

  try {
    await invoke('save_file', {
      path: state.filePath,
      content: state.currentContent
    });

    state.originalContent = state.currentContent;
    updateDirtyState();
  } catch (error) {
    console.error('Failed to save file:', error);
    alert(`Failed to save file: ${error}`);
  }
}

// Close protection
async function setupCloseProtection() {
  if (!appWindow) return;

  try {
    appWindow.onCloseRequested(async (event) => {
      if (state.isDirty) {
        // Prevent close immediately while we show the dialog
        event.preventDefault();

        // Try to use Tauri dialog, fall back to browser confirm
        let confirmed = false;
        try {
          const dialog = window.__TAURI__?.dialog;
          if (dialog && dialog.confirm) {
            confirmed = await dialog.confirm(
              'You have unsaved changes. Are you sure you want to close?',
              { title: 'Unsaved Changes', kind: 'warning' }
            );
          } else {
            confirmed = window.confirm('You have unsaved changes. Are you sure you want to close?');
          }
        } catch (e) {
          confirmed = window.confirm('You have unsaved changes. Are you sure you want to close?');
        }

        // If user confirmed, explicitly close the window
        if (confirmed) {
          await appWindow.close();
        }
      }
    });
  } catch (error) {
    console.error('Failed to setup close protection:', error);
  }
}

// Debounced preview update for live sync
const debouncedRenderPreview = debounce(() => {
  renderPreview();
}, 150);

// Initialize DOM elements
function initElements() {
  elements = {
    preview: document.getElementById('preview'),
    editor: document.getElementById('editor'),
    filename: document.getElementById('filename'),
    dirtyIndicator: document.getElementById('dirty-indicator'),
    toggleMode: document.getElementById('toggle-mode'),
    toggleTheme: document.getElementById('toggle-theme'),
  };

  // Editor input handling with live preview
  elements.editor.addEventListener('input', () => {
    state.currentContent = elements.editor.value;
    updateDirtyState();
    // Update preview in real-time (debounced)
    debouncedRenderPreview();
  });

  // Button click handlers
  elements.toggleMode.addEventListener('click', () => {
    setEditMode(!state.isEditMode);
  });

  elements.toggleTheme.addEventListener('click', toggleTheme);
}

// Keyboard shortcuts
document.addEventListener('keydown', async (e) => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const cmdKey = isMac ? e.metaKey : e.ctrlKey;

  if (cmdKey && e.key === 's') {
    e.preventDefault();
    await saveFile();
  }

  if (cmdKey && e.key === 'e') {
    e.preventDefault();
    setEditMode(!state.isEditMode);
  }
});

// Initialize app
async function init() {
  try {
    // Initialize DOM elements
    initElements();

    // Initialize Tauri APIs
    const tauri = window.__TAURI__;
    if (!tauri) {
      console.error('Tauri API not available');
      elements.preview.innerHTML = '<p class="empty-state">Error: Tauri API not available</p>';
      return;
    }

    invoke = tauri.core.invoke;
    listen = tauri.event.listen;

    // Get current window
    if (tauri.window && tauri.window.getCurrentWindow) {
      appWindow = tauri.window.getCurrentWindow();
    }

    // Set up close protection
    await setupCloseProtection();

    // Apply default theme (dark for retro CRT aesthetic)
    applyTheme('dark');

    // Listen for init event from Rust backend
    await listen('app-init', async (event) => {
      console.log('Received app-init event:', event.payload);
      const { file_path, edit_mode, theme } = event.payload;

      // Apply theme
      applyTheme(theme);

      // Load file if provided, otherwise start blank editor
      if (file_path) {
        await loadFile(file_path);
        // Set initial edit mode if requested
        if (edit_mode) {
          setEditMode(true);
        }
      } else {
        // New blank document mode
        state.filename = 'Untitled';
        state.currentContent = '';
        state.originalContent = '';
        state.filePath = null;
        elements.filename.textContent = 'Untitled';
        elements.preview.innerHTML = '<p class="empty-state">Start typing in edit mode...</p>';
        setEditMode(true);  // Start in edit mode for blank documents
      }
    });

    console.log('Markdown Viewer initialized');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    if (elements.preview) {
      elements.preview.innerHTML = `<p class="empty-state">Error initializing: ${error}</p>`;
    }
  }
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
