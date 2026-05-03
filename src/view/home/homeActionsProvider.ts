import * as vscode from 'vscode';

type HomeAction = {
  label: string;
  description: string;
  command: string;
  icon: string;
};

class HomeActionItem extends vscode.TreeItem {
  constructor(action: HomeAction) {
    super(action.label, vscode.TreeItemCollapsibleState.None);
    this.description = action.description;
    this.tooltip = `${action.label}: ${action.description}`;
    this.iconPath = new vscode.ThemeIcon(action.icon);
    this.command = {
      command: action.command,
      title: action.label,
    };
  }
}

const HOME_ACTIONS: HomeAction[] = [
  {
    label: 'Análise da Issue',
    description: 'Jira',
    command: 'plugin-vscode.openJira',
    icon: 'issues',
  },
  {
    label: 'Planejamento de Cenários',
    description: 'Zephyr',
    command: 'plugin-vscode.openZephyr',
    icon: 'beaker',
  },
  {
    label: 'Geração Backend',
    description: 'API',
    command: 'plugin-vscode.backend',
    icon: 'server-process',
  },
  {
    label: 'Automação Web',
    description: 'Web',
    command: 'plugin-vscode.openWebFlow',
    icon: 'browser',
  },
  {
    label: 'Configurações',
    description: 'Ambiente',
    command: 'plugin-vscode.settings',
    icon: 'gear',
  },
];

export class HomeActionsProvider implements vscode.TreeDataProvider<HomeActionItem> {
  getTreeItem(element: HomeActionItem): vscode.TreeItem {
    return element;
  }

  getChildren(): HomeActionItem[] {
    return HOME_ACTIONS.map(action => new HomeActionItem(action));
  }
}
