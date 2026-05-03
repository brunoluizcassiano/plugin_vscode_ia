import * as path from 'path';
import * as vscode from 'vscode';
import {
  directoryExists,
  fileExists,
  findCypressProjectRoot,
  findDirectoriesByName,
  listFiles,
  relativeToRoot,
} from './cypressProject';

type ArtifactKind = 'root' | 'group' | 'folder' | 'file' | 'empty';

class ArtifactItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly kind: ArtifactKind,
    public readonly fullPath?: string,
    public readonly rootPath?: string,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(label, collapsibleState);
    this.contextValue = kind;
  }
}

const ARTIFACT_GROUPS = [
  { label: 'Features', names: ['feature', 'features'] },
  { label: 'Steps', names: ['steps', 'step_definitions'] },
  { label: 'Controller', names: ['controller', 'controllers'] },
  { label: 'AppDriver', names: ['AppDriver', 'appDriver', 'appdriver'] },
  { label: 'Models', names: ['Model', 'Models', 'model', 'models'] },
  { label: 'Schemas', names: ['Schema', 'Schemas', 'schema', 'schemas'] },
];

export class ArtifactsTreeProvider implements vscode.TreeDataProvider<ArtifactItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<ArtifactItem | undefined | void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  refresh() {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: ArtifactItem): vscode.TreeItem {
    if (element.kind === 'root') {
      element.iconPath = new vscode.ThemeIcon('repo');
      element.description = element.fullPath;
    }

    if (element.kind === 'group') {
      element.iconPath = new vscode.ThemeIcon('folder-library');
    }

    if (element.kind === 'folder') {
      element.iconPath = new vscode.ThemeIcon('folder');
      if (element.rootPath && element.fullPath) {
        element.description = relativeToRoot(element.rootPath, element.fullPath);
      }
    }

    if (element.kind === 'file' && element.fullPath) {
      element.iconPath = new vscode.ThemeIcon('file-code');
      element.resourceUri = vscode.Uri.file(element.fullPath);
      element.command = {
        command: 'vscode.open',
        title: 'Abrir arquivo',
        arguments: [vscode.Uri.file(element.fullPath)],
      };
      element.tooltip = element.fullPath;
    }

    if (element.kind === 'empty') {
      element.iconPath = new vscode.ThemeIcon('info');
    }

    return element;
  }

  getChildren(element?: ArtifactItem): ArtifactItem[] {
    const root = findCypressProjectRoot();
    if (!root) {
      return [new ArtifactItem('Abra um workspace para listar artefatos.', 'empty')];
    }

    if (!element) {
      return [
        new ArtifactItem(path.basename(root), 'root', root, root, vscode.TreeItemCollapsibleState.Expanded),
      ];
    }

    if (element.kind === 'root') {
      return ARTIFACT_GROUPS.map(group => (
        new ArtifactItem(group.label, 'group', group.names.join('|'), root, vscode.TreeItemCollapsibleState.Collapsed)
      ));
    }

    if (element.kind === 'group') {
      const names = (element.fullPath || '').split('|').filter(Boolean);
      const folders = findDirectoriesByName(root, names);

      if (!folders.length) {
        return [new ArtifactItem('Nenhuma pasta encontrada.', 'empty')];
      }

      return folders.map(folder => new ArtifactItem(
        path.basename(folder),
        'folder',
        folder,
        root,
        vscode.TreeItemCollapsibleState.Collapsed
      ));
    }

    if (element.kind === 'folder' && element.fullPath && directoryExists(element.fullPath)) {
      const children = listFiles(element.fullPath).filter(fileExists);
      if (!children.length) return [new ArtifactItem('Nenhum arquivo nesta pasta.', 'empty')];

      return children.map(file => new ArtifactItem(
        relativeToRoot(element.fullPath!, file),
        'file',
        file,
        element.fullPath
      ));
    }

    return [];
  }
}
