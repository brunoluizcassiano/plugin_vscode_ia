import * as vscode from 'vscode';
import { getJiraViewContent } from '../view/jira/jiraView';

 function getNonce() {
   let text = '';
   const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
   for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
   return text;
 }

export class JiraPanel {
  public static currentPanel: JiraPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    const webview = this._panel.webview;
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'style', 'style.css'));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'jira', 'jira.js'));
    const nonce = getNonce();

    this._panel.webview.html = getJiraViewContent({
      webview,
      nonce,
      styleUri: String(styleUri),
      scriptUri: String(scriptUri)
    });

    // &#x1f3a7; Ouvindo mensagens do HTML
    this._panel.webview.onDidReceiveMessage(this.handleMessage.bind(this));

    // &#x1f9f9; Limpa referência ao fechar
    this._panel.onDidDispose(() => {
      JiraPanel.currentPanel = undefined;
    });

    // &#x1f680; Envia nome do usuário assim que carrega
    this.sendNomeUsuario();
  }

  public static async createOrShow(extensionUri: vscode.Uri) {
    if (JiraPanel.currentPanel) {
      JiraPanel.currentPanel._panel.reveal();
    } else {
      const panel = vscode.window.createWebviewPanel('jiraView', 'Jira', vscode.ViewColumn.One, {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
      });
      JiraPanel.currentPanel = new JiraPanel(panel, extensionUri);
    }
  }

  private async sendNomeUsuario() {
    try {
      const nome = await vscode.commands.executeCommand('plugin-vscode.getJiraUser');
      this._panel.webview.postMessage({ type: 'nomeUsuario', nome });
    } catch (error) {
      console.error('Erro ao obter nome do usuário do Jira:', error);
    }
  }

  // ===== IA JSON parsing helpers (robusto + compatível) =====
  private tryExtractJsonObject(text: string): any | null {
    if (!text || typeof text !== 'string') return null;
    let s = text.trim();

    // Remove fences caso venham (```json ... ```)
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();

    // Caso seja JSON puro
    if (s.startsWith('{') && s.endsWith('}')) {
      try {
        return JSON.parse(s);
      } catch {
        // tenta heurística abaixo
      }
    }

    // Heurística: pega do primeiro { ao último }
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first >= 0 && last > first) {
      const candidate = s.slice(first, last + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        return null;
      }
    }

    return null;
  }

  private async handleMessage(message: any) {
    switch (message.type) {
      case 'configurarJira': {
        vscode.window.showInformationMessage('Abrindo configuração do Jira...');
        break;
      }

      case 'carregarProjetos': {
        const projetos = await vscode.commands.executeCommand('plugin-vscode.getJiraProjects');
        this._panel.webview.postMessage({
          type: 'listaProjetos',
          projetos: projetos || [],
        });
        break;
      }

      case 'buscarSugestoesIssue': {
        const { texto, projeto } = message;
        const sugestoes = await vscode.commands.executeCommand('plugin-vscode.buscarSugestoesIssue', texto, projeto);
        this._panel.webview.postMessage({
          type: 'sugestoesIssue',
          sugestoes: sugestoes || [],
        });
        break;
      }

      case 'issuePrefixInvalido': {
        vscode.window.showWarningMessage(
          `O código ${message.issueKey} não pertence ao projeto selecionado (${message.selectedProjectKey})`
        );
        break;
      }

      case 'buscarIssue': {
        const { key } = message;
        const issue = await vscode.commands.executeCommand('plugin-vscode.getJiraIssue', key);
        console.log('&#x1f50d; Resultado da issue:', issue);

        if (issue && typeof issue === 'object' && 'key' in issue) {
          this._panel.webview.postMessage({ type: 'detalhesIssue', issue });
        } else {
          this._panel.webview.postMessage({
            type: 'erroIssue',
            mensagem: '❌ Issue não encontrada.',
          });
        }
        break;
      }

      case 'analisarIA': {
        try {
          const response = await vscode.commands.executeCommand<any>(
            'plugin-vscode.analiseIaQa',
            message.description,
            message.bdd
          );

const aiText = typeof response === 'string' ? response : response?.message || 'Sem resposta da IA.';
          const parsed = this.tryExtractJsonObject(aiText);

          // Compatível: sempre manda "resultado" (string). Se parsear, manda também resultadoJson.
          this._panel.webview.postMessage({
            type: 'resultadoIA',
            resultado: aiText,
            resultadoJson: parsed && typeof parsed === 'object' ? parsed : null,
          });
        } catch (error) {
          this._panel.webview.postMessage({
            type: 'resultadoIA',
            resultado: 'Erro ao consultar a IA.',
            resultadoJson: null,
          });
        }
        break;
      }

      case 'openZephyr': {
        vscode.commands.executeCommand(
          'plugin-vscode.openZephyr',
          message.issueId,
          message.issueKey,
          message.comentario,
          message.description,
          message.bddSpecification
        );
        break;
      }

      case 'enviarComentarioIa': {
        const { issueKey, comentario } = message;
        try {
          await vscode.commands.executeCommand('plugin-vscode.enviarComentarioIssue', issueKey, comentario);
          vscode.window.showInformationMessage(`Comentário enviado com sucesso para ${issueKey}`);
        } catch (error) {
          vscode.window.showErrorMessage(`Erro ao enviar comentário: ${error}`);
        }
        break;
      }
    }
  }
}