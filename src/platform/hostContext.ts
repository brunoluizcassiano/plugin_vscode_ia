import * as vscode from 'vscode';

export type HostKind = 'vscode' | 'windsurf' | 'unknown';

export type HostContext = {
  kind: HostKind;
  appName: string;
  uriScheme: string;
  languageModelAccessStyle: 'extension-access' | 'account-based' | 'unknown';
  displayName: string;
};

export function detectHostKind(): HostKind {
  const appName = (vscode.env.appName || '').toLowerCase();
  const uriScheme = (vscode.env.uriScheme || '').toLowerCase();

  if (appName.includes('windsurf') || uriScheme.includes('windsurf')) {
    return 'windsurf';
  }
  if (
    appName.includes('visual studio code')
    || appName.includes('vscode')
    || appName.includes('code - insiders')
    || uriScheme === 'vscode'
    || uriScheme === 'vscode-insiders'
  ) {
    return 'vscode';
  }
  return 'unknown';
}

export function getHostContext(): HostContext {
  const kind = detectHostKind();
  const appName = vscode.env.appName || 'Unknown Host';
  const uriScheme = vscode.env.uriScheme || '';

  if (kind === 'windsurf') {
    return {
      kind,
      appName,
      uriScheme,
      languageModelAccessStyle: 'account-based',
      displayName: 'Windsurf',
    };
  }

  if (kind === 'vscode') {
    return {
      kind,
      appName,
      uriScheme,
      languageModelAccessStyle: 'extension-access',
      displayName: 'Visual Studio Code',
    };
  }

  return {
    kind,
    appName,
    uriScheme,
    languageModelAccessStyle: 'unknown',
    displayName: appName,
  };
}

export function getLanguageModelPermissionHint(): string {
  const host = getHostContext();
  if (host.languageModelAccessStyle === 'extension-access') {
    return 'Neste host, o acesso a modelos normalmente depende da permissão de Language Model para a extensão.';
  }
  if (host.languageModelAccessStyle === 'account-based') {
    return 'Neste host, o acesso a modelos normalmente depende da conta/recursos nativos do Windsurf.';
  }
  return 'Não foi possível identificar com segurança como este host controla o acesso aos modelos.';
}
