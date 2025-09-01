import * as vscode from 'vscode';
import { getBackendviewContent } from '../view/backendViewForm';
import {
  loadDocumentation,
  unloadDocumentation,
  listEndpointsWithMethods,
  generateFromOpenAPI,
} from '../generators/schema/schema';
import { generateAppDriversFromOpenAPI } from '../generators/app/index';
import { generateModelFromOpenAPI } from '../generators/model/index';
import {
  generateAppDriverFromCurl,
  generateModelFromCurl,
} from '../generators/api/generateFromCurl';

export class BackendPanel {
  public static currentPanel: BackendPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;
    this.panel.webview.html = getBackendviewContent();
    this.registerMessageHandlers();
    this.panel.onDidDispose(() => {
      BackendPanel.currentPanel = undefined;
    });
  }

  public static createOrShow(extensionUri: vscode.Uri) {
    if (BackendPanel.currentPanel) {
      BackendPanel.currentPanel.panel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'backendview',
      'Backend',
      vscode.ViewColumn.One,
      { enableScripts: true, localResourceRoots: [extensionUri] }
    );

    BackendPanel.currentPanel = new BackendPanel(panel);
  }

  private registerMessageHandlers() {
    this.panel.webview.onDidReceiveMessage(async (message: any) => {
      try {
        switch (message.type) {
          case 'selecionarArquivoSchema':
            this.handleSelecionarArquivoSchema();
            break;

          case 'selecionarPastaDestino':
            this.handleSelecionarPastaDestino();
            break;

          case 'formularioPreenchido':
            this.handleFormularioPreenchido(message.dados);
            break;

          default:
            vscode.window.showWarningMessage(`Tipo de mensagem desconhecido: ${message.type}`);
            break;
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(`Erro nos settings: ${err?.message || err}`);
      }
    });
  }

  private async handleSelecionarArquivoSchema() {
    try {
      const fileUri = await vscode.window.showOpenDialog({
        canSelectMany: false,
        openLabel: 'Selecionar arquivo schema',
      });

      if (!fileUri || fileUri.length === 0) return;

      const caminho = fileUri[0].fsPath;

       await loadDocumentation(caminho);
      const endpoints = await listEndpointsWithMethods();
      await unloadDocumentation();

      this.panel.webview.postMessage({
        type: 'schemaSelecionado',
        caminho,
        endpoints,
      });
    } catch (error: any) {
      vscode.window.showErrorMessage(`Erro ao selecionar schema: ${error.message}`);
    }
  }

  private async handleSelecionarPastaDestino() {
    try {
      const folderUri = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: 'Selecionar pasta destino',
      });

      if (!folderUri || folderUri.length === 0) return;

      this.panel.webview.postMessage({
        type: 'pastaSelecionada',
        caminho: folderUri[0].fsPath,
      });
    } catch (error: any) {
      vscode.window.showErrorMessage(`Erro ao selecionar pasta: ${error.message}`);
    }
  }

  private async handleFormularioPreenchido(dados: any) {
    const { tipo, curl, endPointUri, arquivo, pasta, gerar } = dados ?? {};

    try {
      if (tipo === 'curl') {
        if (gerar?.appDriverCurl) {
          await generateAppDriverFromCurl(curl, pasta);
        }

        if (gerar?.modelCurl) {
          await generateModelFromCurl(curl, pasta);
        }
      } else if (tipo === 'schema') {
        if (gerar?.schema) {
          vscode.window.showInformationMessage(`Gerando schema a partir de: ${arquivo}`);
          await loadDocumentation(arquivo);
          await generateFromOpenAPI(pasta);
          await unloadDocumentation();
        }

        if (gerar?.appDriver) {
          await generateAppDriversFromOpenAPI(arquivo, endPointUri, pasta);
        }

        if (gerar?.model) {
          await generateModelFromOpenAPI(arquivo, endPointUri, pasta);
        }
      } else {
        vscode.window.showWarningMessage('Tipo não reconhecido no formulário.');
      }
    } catch (error: any) {
      vscode.window.showErrorMessage(`Erro ao processar formulário: ${error.message}`);
    }
  }
}
