'use strict';

const state = {
  selectedFiles: [], // array of absolute file paths
  outputDir: null,
  results: [], // last processing results
};

// ---------------------------------------------------------------------
// File selection
// ---------------------------------------------------------------------

const fileListEl = document.getElementById('fileList');
const btnSelectFiles = document.getElementById('btnSelectFiles');
const btnProcess = document.getElementById('btnProcess');

function renderFileList() {
  fileListEl.innerHTML = '';
  for (const filePath of state.selectedFiles) {
    const li = document.createElement('li');
    const name = filePath.split(/[\\/]/).pop();
    li.innerHTML = `<span>${escapeHtml(name)}</span>`;
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = () => {
      state.selectedFiles = state.selectedFiles.filter((f) => f !== filePath);
      renderFileList();
      updateProcessButtonState();
    };
    li.appendChild(removeBtn);
    fileListEl.appendChild(li);
  }
}

btnSelectFiles.addEventListener('click', async () => {
  const paths = await window.qtiApp.selectQtiFiles();
  if (paths && paths.length) {
    const merged = new Set([...state.selectedFiles, ...paths]);
    state.selectedFiles = Array.from(merged);
    renderFileList();
    updateProcessButtonState();
  }
});

// ---------------------------------------------------------------------
// Output directory selection
// ---------------------------------------------------------------------

const outputDirLabel = document.getElementById('outputDirLabel');
const btnSelectOutputDir = document.getElementById('btnSelectOutputDir');

btnSelectOutputDir.addEventListener('click', async () => {
  const dir = await window.qtiApp.selectOutputDir();
  if (dir) {
    state.outputDir = dir;
    outputDirLabel.textContent = dir;
    updateProcessButtonState();
  }
});

function updateProcessButtonState() {
  btnProcess.disabled = !(state.selectedFiles.length > 0 && state.outputDir);
}

// ---------------------------------------------------------------------
// Processing
// ---------------------------------------------------------------------

const resultsListEl = document.getElementById('resultsList');

function getSortMode() {
  const checked = document.querySelector('input[name="sortMode"]:checked');
  return checked ? checked.value : 'natural';
}

btnProcess.addEventListener('click', async () => {
  btnProcess.disabled = true;
  resultsListEl.innerHTML = '';
  const itemByName = {};

  for (const filePath of state.selectedFiles) {
    const name = filePath.split(/[\\/]/).pop();
    const li = document.createElement('li');
    li.innerHTML = `<span>${escapeHtml(name)}</span><span class="result-status-pending">Processing\u2026</span>`;
    resultsListEl.appendChild(li);
    itemByName[filePath] = li;
  }

  const stopProgressListener = window.qtiApp.onProcessProgress(({ archiveBaseName }) => {
    for (const [filePath, li] of Object.entries(itemByName)) {
      if (filePath.includes(archiveBaseName)) {
        const statusSpan = li.querySelector('.result-status-pending');
        if (statusSpan) statusSpan.textContent = 'Finishing\u2026';
      }
    }
  });

  const results = await window.qtiApp.processFiles(state.selectedFiles, state.outputDir, getSortMode());
  stopProgressListener();
  state.results = results;

  for (const result of results) {
    const filePath = state.selectedFiles.find((f) => f.includes(result.archiveBaseName));
    const li = itemByName[filePath] || document.createElement('li');
    if (result.ok) {
      li.innerHTML = `
        <span>${escapeHtml(result.archiveBaseName)} \u2014
          <span class="result-status-ok">${result.itemCount} items converted${result.errorCount ? `, ${result.errorCount} errors` : ''}</span>
        </span>
        <span class="result-actions"></span>
      `;
      const actions = li.querySelector('.result-actions');
      addResultAction(actions, 'Item Preview', () => window.qtiApp.openPath(`${result.outDir}/ITEM_PREVIEW.html`));
      addResultAction(actions, 'Print Preview', () => window.qtiApp.openPath(`${result.outDir}/PRINT_PREVIEW.html`));
      addResultAction(actions, 'Log', () => window.qtiApp.openPath(`${result.outDir}/Log.txt`));
      addResultAction(actions, 'Reveal Folder', () => window.qtiApp.revealInFolder(result.outDir));
    } else {
      li.innerHTML = `<span>${escapeHtml(result.archiveBaseName)}</span><span class="result-status-error">Failed: ${escapeHtml(result.error)}</span>`;
    }
  }

  btnProcess.disabled = false;
});

function addResultAction(container, label, onClick) {
  const btn = document.createElement('button');
  btn.className = 'btn-secondary';
  btn.textContent = label;
  btn.onclick = onClick;
  container.appendChild(btn);
}

// ---------------------------------------------------------------------
// Style Editor
// ---------------------------------------------------------------------

const overlay = document.getElementById('styleEditorOverlay');
const styleTextarea = document.getElementById('styleTextarea');
const styleStatusLabel = document.getElementById('styleStatusLabel');

async function openStyleEditor() {
  await refreshStyleEditor();
  overlay.classList.remove('hidden');
}

async function refreshStyleEditor() {
  const { css, isOverride, overrideFilePath } = await window.qtiApp.getStyle();
  styleTextarea.value = css;
  styleStatusLabel.textContent = isOverride
    ? `Currently using your saved custom override: ${overrideFilePath}`
    : `Currently using the baseline (factory default) stylesheet. Save changes here to create your own override at: ${overrideFilePath}`;
}

document.getElementById('btnOpenStyleEditor').addEventListener('click', openStyleEditor);
document.getElementById('btnCloseStyleEditor').addEventListener('click', () => overlay.classList.add('hidden'));

document.getElementById('btnSaveStyle').addEventListener('click', async () => {
  await window.qtiApp.saveStyle(styleTextarea.value);
  await refreshStyleEditor();
});

document.getElementById('btnResetStyle').addEventListener('click', async () => {
  await window.qtiApp.resetStyle();
  await refreshStyleEditor();
});

document.getElementById('btnRevealStyleFile').addEventListener('click', async () => {
  const { overrideFilePath } = await window.qtiApp.getStyle();
  window.qtiApp.revealInFolder(overrideFilePath);
});

document.getElementById('btnReloadStyle').addEventListener('click', refreshStyleEditor);

// ---------------------------------------------------------------------
// Menu bar wiring
// ---------------------------------------------------------------------

window.qtiApp.onMenuSelectFiles(() => btnSelectFiles.click());
window.qtiApp.onMenuSelectOutputDir(() => btnSelectOutputDir.click());
window.qtiApp.onMenuOpenStyleEditor(() => openStyleEditor());

// ---------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
