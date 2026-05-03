const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourceRoot = path.join(root, 'src', 'view');
const targetRoot = path.join(root, 'out', 'view');

const assets = [
  ['backend', 'backend.js'],
  ['jira', 'jira.js'],
  ['settings', 'settings.js'],
  ['zephyr', 'zephyr.js'],
  ['style', 'style.css'],
];

for (const [folder, file] of assets) {
  const source = path.join(sourceRoot, folder, file);
  const target = path.join(targetRoot, folder, file);

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}
