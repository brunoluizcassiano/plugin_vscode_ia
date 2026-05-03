import * as vscode from 'vscode';
import {
  findCypressProjectRoot,
  relativeToRoot,
} from './cypressProject';
import {
  CypressResult,
  CypressTestCase,
  getLatestCypressResult,
} from './projectStatusProvider';

type TestNodeKind = 'group' | 'summary' | 'test' | 'file' | 'empty';

class CypressTestItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly kind: TestNodeKind,
    public readonly detail?: string,
    public readonly testCase?: CypressTestCase,
    public readonly filePath?: string,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(label, collapsibleState);
    this.contextValue = kind;
    this.description = detail;
  }
}

export class CypressTestsProvider implements vscode.TreeDataProvider<CypressTestItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<CypressTestItem | undefined | void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private result?: CypressResult;
  private loading = false;
  private watchers: vscode.FileSystemWatcher[] = [];
  private watchedRoot?: string;

  constructor() {
    this.configureWatchers();
  }

  async refresh() {
    this.loading = true;
    this.onDidChangeTreeDataEmitter.fire();

    const root = findCypressProjectRoot();
    this.configureWatchers(root);
    const latest = root ? await getLatestCypressResult(root) : undefined;
    this.result = latest || this.result;

    this.loading = false;
    this.onDidChangeTreeDataEmitter.fire();
  }

  dispose() {
    this.watchers.forEach(watcher => watcher.dispose());
    this.watchers = [];
  }

  private configureWatchers(root = findCypressProjectRoot()) {
    if (!root || root === this.watchedRoot) return;

    this.watchers.forEach(watcher => watcher.dispose());
    this.watchers = [];
    this.watchedRoot = root;

    for (const pattern of ['temp/**/*.{json,xml}', 'report/**/*.{json,xml}', 'cypress/report/**/*.{json,xml}']) {
      const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(root, pattern));
      watcher.onDidCreate(() => void this.refresh());
      watcher.onDidChange(() => void this.refresh());
      this.watchers.push(watcher);
    }
  }

  getTreeItem(element: CypressTestItem): vscode.TreeItem {
    if (element.kind === 'group') element.iconPath = new vscode.ThemeIcon('beaker');
    if (element.kind === 'summary') element.iconPath = new vscode.ThemeIcon(summaryIcon(element.label));
    if (element.kind === 'empty') element.iconPath = new vscode.ThemeIcon('info');

    if (element.kind === 'test') {
      const status = element.testCase?.status || 'unknown';
      element.iconPath = new vscode.ThemeIcon(statusIcon(status), statusColor(status));
      element.tooltip = element.testCase?.error || element.label;
    }

    if (element.kind === 'file' && element.filePath) {
      element.iconPath = new vscode.ThemeIcon('file-code');
      element.resourceUri = vscode.Uri.file(element.filePath);
      element.command = {
        command: 'vscode.open',
        title: 'Abrir relatório',
        arguments: [vscode.Uri.file(element.filePath)],
      };
      element.tooltip = element.filePath;
    }

    return element;
  }

  getChildren(element?: CypressTestItem): CypressTestItem[] {
    const root = findCypressProjectRoot();
    if (!root) return [new CypressTestItem('Abra um workspace para ler os testes.', 'empty')];
    if (this.loading) return [new CypressTestItem('Atualizando...', 'empty')];

    const result = this.result;
    if (!result) return [new CypressTestItem('Nenhum relatório Cypress encontrado.', 'empty')];

    if (!element) {
      return [
        new CypressTestItem('Última execução', 'group', undefined, undefined, undefined, vscode.TreeItemCollapsibleState.Expanded),
        new CypressTestItem('Testes', 'group', undefined, undefined, undefined, vscode.TreeItemCollapsibleState.Expanded),
        new CypressTestItem(relativeToRoot(root, result.file), 'file', undefined, undefined, result.file),
      ];
    }

    if (element.label === 'Última execução') {
      return [
        new CypressTestItem('Total', 'summary', String(result.tests ?? '-')),
        new CypressTestItem('Passou', 'summary', String(result.passes ?? '-')),
        new CypressTestItem('Falhou', 'summary', String(result.failures ?? '-')),
        new CypressTestItem('Pendente', 'summary', String(result.pending ?? '-')),
        new CypressTestItem('Duração', 'summary', result.duration || '-'),
      ];
    }

    if (element.label === 'Testes') {
      const cases = result.cases || [];
      if (!cases.length) return [new CypressTestItem('Relatório sem casos individuais.', 'empty')];

      return cases.map(test => new CypressTestItem(
        test.title,
        'test',
        test.duration,
        test
      ));
    }

    return [];
  }
}

function summaryIcon(label: string): string {
  if (label === 'Passou') return 'pass';
  if (label === 'Falhou') return 'error';
  if (label === 'Pendente') return 'circle-outline';
  if (label === 'Duração') return 'watch';
  return 'list-unordered';
}

function statusIcon(status: CypressTestCase['status']): string {
  if (status === 'passed') return 'pass';
  if (status === 'failed') return 'error';
  if (status === 'pending') return 'circle-outline';
  return 'question';
}

function statusColor(status: CypressTestCase['status']): vscode.ThemeColor | undefined {
  if (status === 'passed') return new vscode.ThemeColor('testing.iconPassed');
  if (status === 'failed') return new vscode.ThemeColor('testing.iconFailed');
  if (status === 'pending') return new vscode.ThemeColor('testing.iconSkipped');
  return undefined;
}
