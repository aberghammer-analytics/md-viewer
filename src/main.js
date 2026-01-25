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

// Guard to prevent rapid toggle conflicts
let toggleInProgress = false;

// Debounce utility for live preview
function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Scroll position utilities for edit/preview sync
function getScrollPercentage(element) {
  const { scrollTop, scrollHeight, clientHeight } = element;
  const maxScroll = scrollHeight - clientHeight;
  if (maxScroll <= 0) return 0;
  return scrollTop / maxScroll;
}

function setScrollPercentage(element, percentage) {
  const { scrollHeight, clientHeight } = element;
  const maxScroll = scrollHeight - clientHeight;
  if (maxScroll <= 0) {
    element.scrollTop = 0;
    return;
  }
  element.scrollTop = Math.max(0, Math.min(1, percentage)) * maxScroll;
}

// Wait for element layout to stabilize (needed for scroll sync)
function waitForLayout(element, maxAttempts = 10) {
  return new Promise((resolve) => {
    let attempts = 0;
    let lastScrollHeight = 0;

    function check() {
      const currentHeight = element.scrollHeight;
      if (currentHeight === lastScrollHeight && currentHeight > 0) {
        resolve();
        return;
      }
      lastScrollHeight = currentHeight;
      attempts++;
      if (attempts >= maxAttempts) {
        resolve();
        return;
      }
      requestAnimationFrame(() => requestAnimationFrame(check));
    }
    requestAnimationFrame(check);
  });
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
async function setEditMode(editMode) {
  if (toggleInProgress) return;
  toggleInProgress = true;

  try {
    state.isEditMode = editMode;

    // Capture scroll from currently visible element BEFORE changes
    const sourceElement = editMode ? elements.preview : elements.editor;
    let scrollPercentage = 0;

    console.log('--- Toggle Mode ---');
    console.log('Switching to:', editMode ? 'EDIT' : 'PREVIEW');
    console.log('Source element hidden?', sourceElement.hidden);
    console.log('Source scrollHeight:', sourceElement.scrollHeight);
    console.log('Source clientHeight:', sourceElement.clientHeight);
    console.log('Source scrollTop:', sourceElement.scrollTop);

    if (!sourceElement.hidden && sourceElement.scrollHeight > sourceElement.clientHeight) {
      scrollPercentage = getScrollPercentage(sourceElement);
    }
    console.log('Captured scroll percentage:', scrollPercentage);

    if (editMode) {
      // Switching to Edit Mode
      // Show editor FIRST, then set content (avoids scroll issues with hidden elements)
      elements.preview.hidden = true;
      elements.editor.hidden = false;

      // Set value (this may auto-scroll, so we'll fix it after layout)
      elements.editor.value = state.currentContent;
      elements.editor.scrollTop = 0; // Reset any auto-scroll from setting value

      setIconPath(elements.toggleMode, icons.eye);
      elements.toggleMode.title = 'Toggle to Preview (Cmd+E)';

      await waitForLayout(elements.editor);
      console.log('Editor scrollHeight after layout:', elements.editor.scrollHeight);

      // Set scroll position
      setScrollPercentage(elements.editor, scrollPercentage);
      console.log('Editor scrollTop after setting:', elements.editor.scrollTop);

      // Focus without scrolling by using preventScroll option
      elements.editor.focus({ preventScroll: true });
      console.log('Editor scrollTop after focus:', elements.editor.scrollTop);

    } else {
      // Switching to Preview Mode
      elements.editor.hidden = true;
      elements.preview.hidden = false;

      setIconPath(elements.toggleMode, icons.pencil);
      elements.toggleMode.title = 'Toggle to Edit (Cmd+E)';

      await renderPreview();
      await waitForLayout(elements.preview);
      console.log('Preview scrollHeight after layout:', elements.preview.scrollHeight);
      setScrollPercentage(elements.preview, scrollPercentage);
      console.log('Preview scrollTop after setting:', elements.preview.scrollTop);
    }
  } finally {
    toggleInProgress = false;
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
let pendingClose = false;

async function setupCloseProtection() {
  if (!appWindow) return;

  // Modal button handlers
  elements.modalSaveAs.addEventListener('click', async () => {
    elements.unsavedModal.hidden = true;
    const path = await saveFileAs();
    if (path) {
      await invoke('save_file', { path, content: state.currentContent });
    }
    await appWindow.close();
  });

  elements.modalDontSave.addEventListener('click', async () => {
    elements.unsavedModal.hidden = true;
    state.isDirty = false; // Prevent re-triggering
    await appWindow.close();
  });

  elements.modalCancel.addEventListener('click', () => {
    elements.unsavedModal.hidden = true;
    pendingClose = false;
  });

  // Window close handler
  appWindow.onCloseRequested(async (event) => {
    if (state.isDirty && !pendingClose) {
      event.preventDefault();
      pendingClose = true;
      elements.unsavedModal.hidden = false;
    }
  });
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
    unsavedModal: document.getElementById('unsaved-modal'),
    modalSaveAs: document.getElementById('modal-save-as'),
    modalDontSave: document.getElementById('modal-dont-save'),
    modalCancel: document.getElementById('modal-cancel'),
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

  // Handle all links in preview
  elements.preview.addEventListener('click', async (e) => {
    const link = e.target.closest('a');
    if (!link) return;

    e.preventDefault();
    const href = link.getAttribute('href');
    if (!href) return;

    // Internal anchor links - scroll behavior
    if (href.startsWith('#')) {
      const targetId = href.slice(1);
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    // External links - confirm and open in browser
    await handleExternalLink(href);
  });
}

// Handle external links with confirmation dialog
async function handleExternalLink(url) {
  const { openUrl } = window.__TAURI__.opener;
  const { ask } = window.__TAURI__.dialog;

  const skipConfirm = localStorage.getItem('skipExternalLinkConfirm') === 'true';

  if (skipConfirm) {
    await openUrl(url);
    return;
  }

  // First dialog: confirm opening
  const shouldOpen = await ask(
    `This link will open in your browser:\n${url}`,
    { title: 'Open External Link?', kind: 'warning', okLabel: 'Open', cancelLabel: 'Cancel' }
  );

  if (!shouldOpen) return;

  // Second dialog: remember choice
  const alwaysOpen = await ask(
    'Always open external links without asking?',
    { title: 'Remember Choice?', kind: 'info', okLabel: 'Yes', cancelLabel: 'No' }
  );

  if (alwaysOpen) {
    localStorage.setItem('skipExternalLinkConfirm', 'true');
  }

  await openUrl(url);
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
