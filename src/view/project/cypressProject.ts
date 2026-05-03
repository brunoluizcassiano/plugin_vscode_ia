import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'out', 'coverage']);

export function directoryExists(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

export function fileExists(target: string): boolean {
  try {
    return fs.statSync(target).isFile();
  } catch {
    return false;
  }
}

export function getWorkspaceRoots(): string[] {
  return (vscode.workspace.workspaceFolders || []).map(folder => folder.uri.fsPath);
}

export function hasCypressDependency(root: string): boolean {
  const packagePath = path.join(root, 'package.json');
  if (!fileExists(packagePath)) return false;

  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return !!(
      pkg?.dependencies?.cypress ||
      pkg?.devDependencies?.cypress ||
      pkg?.scripts?.cypress ||
      pkg?.scripts?.['cy:run'] ||
      pkg?.scripts?.['cypress:run']
    );
  } catch {
    return false;
  }
}

export function findCypressProjectRoot(): string | undefined {
  const roots = getWorkspaceRoots();
  const direct = roots.find(root => directoryExists(path.join(root, 'cypress')) || hasCypressDependency(root));
  if (direct) return direct;

  for (const root of roots) {
    const found = findDirectory(root, candidate => (
      path.basename(candidate).toLowerCase() === 'cypress' ||
      hasCypressDependency(candidate)
    ), 3);
    if (!found) continue;
    return path.basename(found).toLowerCase() === 'cypress' ? path.dirname(found) : found;
  }

  return roots[0];
}

export function findDirectory(root: string, predicate: (dir: string) => boolean, maxDepth = 4): string | undefined {
  function walk(dir: string, depth: number): string | undefined {
    if (depth > maxDepth) return undefined;
    if (predicate(dir)) return dir;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return undefined;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || IGNORED_DIRS.has(entry.name)) continue;
      const found = walk(path.join(dir, entry.name), depth + 1);
      if (found) return found;
    }

    return undefined;
  }

  return walk(root, 0);
}

export function findDirectoriesByName(root: string, names: string[], maxDepth = 6): string[] {
  const wanted = new Set(names.map(name => name.toLowerCase()));
  const found: string[] = [];

  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || IGNORED_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (wanted.has(entry.name.toLowerCase())) found.push(fullPath);
      walk(fullPath, depth + 1);
    }
  }

  if (directoryExists(root)) walk(root, 0);
  return found;
}

export function listFiles(dir: string, maxFiles = 60): string[] {
  const files: string[] = [];

  function walk(current: string) {
    if (files.length >= maxFiles) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (files.length >= maxFiles) return;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) walk(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }

  if (directoryExists(dir)) walk(dir);
  return files;
}

export function relativeToRoot(root: string, target: string): string {
  const relative = path.relative(root, target);
  return relative || path.basename(target);
}
