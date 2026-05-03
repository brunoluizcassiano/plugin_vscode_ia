const vscode = acquireVsCodeApi();

document.getElementById('btnHomeJira')?.addEventListener('click', () => {
  vscode.postMessage({ command: 'openJira' });
});

document.getElementById('btnHomeZephyr')?.addEventListener('click', () => {
  vscode.postMessage({ command: 'openZephyr' });
});

document.getElementById('btnHomeBackend')?.addEventListener('click', () => {
  vscode.postMessage({ command: 'backend' });
});

document.getElementById('btnHomeWeb')?.addEventListener('click', () => {
  vscode.postMessage({ type: 'navegar', destino: 'web' });
});

document.getElementById('btnHomeSettings')?.addEventListener('click', () => {
  vscode.postMessage({ command: 'settings' });
});
