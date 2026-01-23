// Markdown Viewer - Frontend Logic

// Application state
const state = {
  filePath: null,
  filename: 'No file loaded',
  originalContent: '',
  currentContent: '',
  isEditMode: false,
  isDirty: false,
  theme: 'system',
};

// DOM Elements (initialized after DOM ready)
let elements = {};

// Tauri APIs (initialized after Tauri is ready)
let invoke, listen, appWindow;

// Theme management
function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  state.theme = theme;
  const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;
  document.documentElement.setAttribute('data-theme', effectiveTheme);

  // Update theme button icon
  const icons = { light: '☀️', dark: '🌙', system: '💻' };
  if (elements.toggleTheme) {
    elements.toggleTheme.querySelector('.icon').textContent = icons[theme] || '🌙';
  }
}

function toggleTheme() {
  const themes = ['system', 'light', 'dark'];
  const currentIndex = themes.indexOf(state.theme);
  const nextTheme = themes[(currentIndex + 1) % themes.length];
  applyTheme(nextTheme);
}

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.theme === 'system') {
    applyTheme('system');
  }
});

// Edit/Preview mode management
function setEditMode(editMode) {
  state.isEditMode = editMode;

  if (editMode) {
    elements.preview.hidden = true;
    elements.editor.hidden = false;
    elements.editor.value = state.currentContent;
    elements.editor.focus();
    elements.toggleMode.querySelector('.icon').textContent = '👁️';
    elements.toggleMode.title = 'Toggle to Preview (Cmd+E)';
  } else {
    elements.editor.hidden = true;
    elements.preview.hidden = false;
    elements.toggleMode.querySelector('.icon').textContent = '📝';
    elements.toggleMode.title = 'Toggle to Edit (Cmd+E)';

    // Re-render preview if content changed
    if (state.currentContent !== state.originalContent || state.isDirty) {
      renderPreview();
    }
  }
}

async function renderPreview() {
  if (!state.currentContent) {
    elements.preview.innerHTML = '<p class="empty-state">No file loaded. Open a markdown file to get started.</p>';
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

async function saveFile() {
  if (!state.filePath || !state.isDirty) return;

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

        if (!confirmed) {
          event.preventDefault();
        }
      }
    });
  } catch (error) {
    console.error('Failed to setup close protection:', error);
  }
}

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

  // Editor input handling
  elements.editor.addEventListener('input', () => {
    state.currentContent = elements.editor.value;
    updateDirtyState();
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

    // Apply default theme
    applyTheme('system');

    // Listen for init event from Rust backend
    await listen('app-init', async (event) => {
      console.log('Received app-init event:', event.payload);
      const { file_path, edit_mode, theme } = event.payload;

      // Apply theme
      applyTheme(theme);

      // Load file if provided
      if (file_path) {
        await loadFile(file_path);
      }

      // Set initial edit mode
      if (edit_mode) {
        setEditMode(true);
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
