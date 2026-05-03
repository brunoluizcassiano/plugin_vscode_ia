import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  directoryExists,
  fileExists,
  findCypressProjectRoot,
} from './cypressProject';

type StatusKind = 'group' | 'item' | 'empty';

class ProjectStatusItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly kind: StatusKind,
    public readonly detail?: string,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(label, collapsibleState);
    this.contextValue = kind;
    this.description = detail;
  }
}

type GitInfo = {
  branch?: string;
  changes?: number;
  lastCommit?: string;
};

export type CypressTestCase = {
  title: string;
  status: 'passed' | 'failed' | 'pending' | 'unknown';
  duration?: string;
  error?: string;
};

export type CypressResult = {
  file: string;
  tests?: number;
  passes?: number;
  failures?: number;
  pending?: number;
  duration?: string;
  cases?: CypressTestCase[];
};

export class ProjectStatusProvider implements vscode.TreeDataProvider<ProjectStatusItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<ProjectStatusItem | undefined | void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private gitInfo?: GitInfo;
  private loading = false;

  async refresh() {
    this.loading = true;
    this.onDidChangeTreeDataEmitter.fire();

    const root = findCypressProjectRoot();
    this.gitInfo = root ? await getGitInfo(root) : undefined;

    this.loading = false;
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: ProjectStatusItem): vscode.TreeItem {
    if (element.kind === 'group') element.iconPath = new vscode.ThemeIcon('repo');
    if (element.kind === 'item') element.iconPath = new vscode.ThemeIcon('circle-filled');
    if (element.kind === 'empty') element.iconPath = new vscode.ThemeIcon('info');
    return element;
  }

  getChildren(element?: ProjectStatusItem): ProjectStatusItem[] {
    const root = findCypressProjectRoot();
    if (!root) return [new ProjectStatusItem('Abra um workspace para ler o projeto.', 'empty')];
    if (this.loading) return [new ProjectStatusItem('Atualizando...', 'empty')];

    if (!element) {
      return [
        new ProjectStatusItem('Git', 'group', undefined, vscode.TreeItemCollapsibleState.Expanded),
      ];
    }

    if (element.label === 'Git') {
      const info = this.gitInfo;
      if (!info) return [new ProjectStatusItem('Sem informações Git.', 'empty')];

      return [
        new ProjectStatusItem('Branch', 'item', info.branch || '-'),
        new ProjectStatusItem('Alterações', 'item', String(info.changes ?? 0)),
        new ProjectStatusItem('Último commit', 'item', info.lastCommit || '-'),
      ];
    }

    return [];
  }
}

function runGit(root: string, args: string[]): Promise<string | undefined> {
  return new Promise(resolve => {
    execFile('git', args, { cwd: root }, (error, stdout) => {
      if (error) return resolve(undefined);
      resolve(String(stdout || '').trim());
    });
  });
}

async function getGitInfo(root: string): Promise<GitInfo | undefined> {
  const branch = await runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (!branch) return undefined;

  const status = await runGit(root, ['status', '--porcelain']);
  const lastCommit = await runGit(root, ['log', '-1', '--pretty=%h %s']);

  return {
    branch,
    changes: status ? status.split(/\r?\n/).filter(Boolean).length : 0,
    lastCommit,
  };
}

export async function getLatestCypressResult(root: string): Promise<CypressResult | undefined> {
  const candidates = findResultFiles(root);
  if (!candidates.length) return undefined;

  candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  for (const file of candidates.slice(0, 12)) {
    const parsed = parseCypressResult(file);
    if (parsed) return parsed;
  }

  return { file: candidates[0] };
}

function findResultFiles(root: string): string[] {
  const files: string[] = [];
  const maxDepth = 7;

  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['.git', 'node_modules', 'dist', 'out'].includes(entry.name)) continue;
        walk(fullPath, depth + 1);
        continue;
      }

      if (!entry.isFile()) continue;
      const lower = entry.name.toLowerCase();
      const parent = path.dirname(fullPath).toLowerCase();
      const likelyReportDir = parent.includes('cypress') || parent.includes('report') || parent.includes('result') || parent.includes('mochawesome') || parent.includes('temp');
      const likelyReportFile = lower.endsWith('.json') || lower.endsWith('.xml');
      const knownName = lower.includes('mochawesome') || lower.includes('junit') || lower.includes('cypress') || lower.includes('results_scenarios') || lower.includes('resultrest');

      if (likelyReportDir && likelyReportFile && (knownName || parent.includes('result') || parent.includes('report'))) {
        files.push(fullPath);
      }
    }
  }

  if (directoryExists(root)) walk(root, 0);
  return files.filter(fileExists);
}

function parseCypressResult(file: string): CypressResult | undefined {
  const lower = file.toLowerCase();
  try {
    const content = fs.readFileSync(file, 'utf8');
    if (lower.endsWith('.json')) return parseJsonResult(file, content);
    if (lower.endsWith('.xml')) return parseXmlResult(file, content);
  } catch {
    return undefined;
  }

  return undefined;
}

function parseJsonResult(file: string, content: string): CypressResult | undefined {
  const json = JSON.parse(content);

  if (Array.isArray(json) && json.some(item => item?.nomeCenario || item?.status || item?.annotation)) {
    const cases = json.map(item => ({
      title: [item?.annotation, item?.nomeCenario || item?.title].filter(Boolean).join(' - ') || 'Cenario sem nome',
      status: normalizeStatus(item?.status),
      duration: formatDuration(item?.duration),
      error: item?.errorMessage || undefined,
    }));

    return {
      file,
      tests: cases.length,
      passes: cases.filter(test => test.status === 'passed').length,
      failures: cases.filter(test => test.status === 'failed').length,
      pending: cases.filter(test => test.status === 'pending').length,
      cases,
    };
  }

  const stats = json?.stats || json?.results?.stats || json?.result?.stats;
  if (stats) {
    return {
      file,
      tests: numberOrUndefined(stats.tests),
      passes: numberOrUndefined(stats.passes ?? stats.passed),
      failures: numberOrUndefined(stats.failures ?? stats.failed),
      pending: numberOrUndefined(stats.pending ?? stats.skipped),
      duration: formatDuration(stats.duration),
      cases: collectJsonTestCases(json),
    };
  }

  if (typeof json?.totalTests === 'number' || typeof json?.totalFailed === 'number') {
    return {
      file,
      tests: numberOrUndefined(json.totalTests),
      passes: numberOrUndefined(json.totalPassed),
      failures: numberOrUndefined(json.totalFailed),
      pending: numberOrUndefined(json.totalPending ?? json.totalSkipped),
      duration: formatDuration(json.totalDuration),
      cases: collectJsonTestCases(json),
    };
  }

  return undefined;
}

function parseXmlResult(file: string, content: string): CypressResult | undefined {
  const suite = content.match(/<testsuite\b[^>]*>/)?.[0] || content.match(/<testsuites\b[^>]*>/)?.[0];
  if (!suite) return undefined;

  return {
    file,
    tests: numberOrUndefined(getXmlAttr(suite, 'tests')),
    failures: numberOrUndefined(getXmlAttr(suite, 'failures')),
    pending: numberOrUndefined(getXmlAttr(suite, 'skipped')),
    duration: formatSeconds(getXmlAttr(suite, 'time')),
    cases: collectXmlTestCases(content),
  };
}

function collectJsonTestCases(json: any): CypressTestCase[] {
  const cases: CypressTestCase[] = [];

  function visit(node: any, parents: string[] = []) {
    if (!node || typeof node !== 'object') return;

    const title = typeof node.title === 'string' ? node.title : undefined;
    const nextParents = title ? [...parents, title] : parents;

    if (Array.isArray(node.tests)) {
      for (const test of node.tests) {
        const testTitle = [nextParents.join(' '), test?.title].filter(Boolean).join(' - ');
        if (!testTitle) continue;
        cases.push({
          title: testTitle,
          status: normalizeStatus(test?.state || test?.status || (test?.fail ? 'failed' : undefined)),
          duration: formatDuration(test?.duration),
          error: test?.err?.message || test?.error || undefined,
        });
      }
    }

    for (const key of ['results', 'suites', 'children']) {
      if (!Array.isArray(node[key])) continue;
      for (const child of node[key]) visit(child, nextParents);
    }
  }

  visit(json);
  return cases;
}

function collectXmlTestCases(content: string): CypressTestCase[] {
  const cases: CypressTestCase[] = [];
  const matches = content.match(/<testcase\b[\s\S]*?<\/testcase>|<testcase\b[^/>]*\/>/g) || [];

  for (const item of matches) {
    const openTag = item.match(/<testcase\b[^>]*>/)?.[0] || item;
    const classname = getXmlAttr(openTag, 'classname');
    const name = getXmlAttr(openTag, 'name');
    const failed = /<failure\b/.test(item);
    const skipped = /<skipped\b/.test(item);

    cases.push({
      title: [classname, name].filter(Boolean).join(' - ') || 'Teste sem nome',
      status: failed ? 'failed' : skipped ? 'pending' : 'passed',
      duration: formatSeconds(getXmlAttr(openTag, 'time')),
      error: item.match(/<failure\b[^>]*>([\s\S]*?)<\/failure>/)?.[1]?.trim(),
    });
  }

  return cases;
}

function getXmlAttr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];
}

function normalizeStatus(value: unknown): CypressTestCase['status'] {
  const status = String(value || '').toLowerCase();
  if (['passed', 'pass', 'ok'].includes(status)) return 'passed';
  if (['failed', 'fail', 'error'].includes(status)) return 'failed';
  if (['pending', 'skipped', 'skip', 'not executed'].includes(status)) return 'pending';
  return 'unknown';
}

function numberOrUndefined(value: unknown): number | undefined {
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function formatDuration(value: unknown): string | undefined {
  const num = numberOrUndefined(value);
  if (num === undefined) return undefined;
  if (num > 1000) return `${(num / 1000).toFixed(1)}s`;
  return `${num}ms`;
}

function formatSeconds(value: unknown): string | undefined {
  const num = numberOrUndefined(value);
  if (num === undefined) return undefined;
  return `${num.toFixed(1)}s`;
}
