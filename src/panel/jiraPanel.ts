import * as vscode from 'vscode';
import { getJiraViewContent } from '../view/jira/jiraView';
export class JiraPanel {
 public static currentPanel: JiraPanel | undefined;
 private readonly _panel: vscode.WebviewPanel;
 private readonly _extensionUri: vscode.Uri;
 private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
   this._panel = panel;
   this._extensionUri = extensionUri;
   this._panel.webview.html = getJiraViewContent();
   // 🎧 Ouvindo mensagens do HTML
   this._panel.webview.onDidReceiveMessage(this.handleMessage.bind(this));
   // 🧹 Limpa referência ao fechar
   this._panel.onDidDispose(() => {
     JiraPanel.currentPanel = undefined;
   });
   // 🚀 Envia nome do usuário assim que carrega
   this.sendNomeUsuario();
 }
 public static async createOrShow(extensionUri: vscode.Uri) {
   if (JiraPanel.currentPanel) {
     JiraPanel.currentPanel._panel.reveal();
   } else {
     const panel = vscode.window.createWebviewPanel(
       'jiraView',
       'Jira',
       vscode.ViewColumn.One,
       { enableScripts: true }
     );
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
         projetos: projetos || []
       });
       break;
     }
     case 'buscarSugestoesIssue': {
       const { texto, projeto } = message;
       const sugestoes = await vscode.commands.executeCommand(
         'plugin-vscode.buscarSugestoesIssue',
         texto,
         projeto
       );
       this._panel.webview.postMessage({
         type: 'sugestoesIssue',
         sugestoes: sugestoes || []
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
       const issue = await vscode.commands.executeCommand(
         'plugin-vscode.getJiraIssue',
         key
       );
       console.log('🔍 Resultado da issue:', issue);
       if (issue && typeof issue === 'object' && 'key' in issue) {
         this._panel.webview.postMessage({ type: 'detalhesIssue', issue });
       } else {
         this._panel.webview.postMessage({
           type: 'erroIssue',
           mensagem: '❌ Issue não encontrada.'
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
         const aiResult = typeof response === 'string' ? response : (response?.message || 'Sem resposta da IA.');
         this._panel.webview.postMessage({
           type: 'resultadoIA',
           resultado: aiResult
         });
       } catch (error) {
         this._panel.webview.postMessage({
           type: 'resultadoIA',
           resultado: 'Erro ao consultar a IA.'
         });
       }
       break;
     }
     case 'openZephyr': {
       vscode.commands.executeCommand('plugin-vscode.openZephyr', message.issueId, message.issueKey, message.comentario, message.description, message.bddSpecification);
       break;
     }
     case 'enviarComentarioIa': {
       const { issueKey, comentario } = message;
       try {
         await vscode.commands.executeCommand(
           'plugin-vscode.enviarComentarioIssue',
           issueKey,
           comentario
         );
         vscode.window.showInformationMessage(`Comentário enviado com sucesso para ${issueKey}`);
       } catch (error) {
         vscode.window.showErrorMessage(`Erro ao enviar comentário: ${error}`);
       }
       break;
     }
   }
 }
}
// import * as vscode from 'vscode';
// import { getJiraViewContent } from '../view/jira/jiraView';
// export class JiraPanel {
//  public static currentPanel: JiraPanel | undefined;
//  private readonly _panel: vscode.WebviewPanel;
//  private readonly _extensionUri: vscode.Uri;
//  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
//    this._panel = panel;
//    this._extensionUri = extensionUri;
//    this._panel.webview.html = getJiraViewContent();
//    // 🎧 Ouvindo mensagens do HTML
//    this._panel.webview.onDidReceiveMessage(this.handleMessage.bind(this));
//    // 🧹 Limpa referência ao fechar
//    this._panel.onDidDispose(() => {
//      JiraPanel.currentPanel = undefined;
//    });
//    // 🔗 Abrir Zephyr
//    panel.webview.onDidReceiveMessage(async message => {
//      if (message.command === 'openZephyr') {
//        vscode.commands.executeCommand('plugin-vscode.openZephyr', message.issueKey);
//        return;
//      }
//    });
//    // ⚠️ Prefixo inválido
//    panel.webview.onDidReceiveMessage(async message => {
//      if (message.type === 'issuePrefixInvalido') {
//        vscode.window.showWarningMessage(
//          `O código ${message.issueKey} não pertence ao projeto selecionado (${message.selectedProjectKey})`
//        );
//        return;
//      }
//    });
//    // 🚀 Buscar issue
//    panel.webview.onDidReceiveMessage(async message => {
//      if (message.type === 'buscarIssue') {
//        const { key } = message;
//        const issue = await vscode.commands.executeCommand(
//          'plugin-vscode.getJiraIssue',
//          key
//        );
//        console.log('🔍 Resultado da issue:', issue);
//        if (issue && typeof issue === 'object' && 'key' in issue) {
//          this._panel.webview.postMessage({ type: 'detalhesIssue', issue });
//        } else {
//          this._panel.webview.postMessage({
//            type: 'erroIssue',
//            mensagem: '❌ Issue não encontrada.'
//          });
//        }
//      }
//    });
//    // 🤖 Analisar com IA QA (Copilot)
//    panel.webview.onDidReceiveMessage(async message => {
//      if (message.type === 'analisarIA') {
//        const prompt = `
// Você é um especialista em qualidade de software.
// Com base na descrição abaixo e no BDD, avalie os seguintes pontos:
// 1. O que está claro e bem especificado?
// 2. O que pode causar ambiguidade ou dúvida?
// 3. Que sugestões você faria para melhorar a especificação?
// ---
// Descrição:
// ${message.description}
// BDD:
// ${message.bdd}
// `;
//        try {
//          const response = await vscode.commands.executeCommand<any>(
//            'plugin-vscode.analiseIaQa',
//            prompt
//          );
//          const aiResult = typeof response === 'string' ? response : (response?.message || 'Sem resposta da IA.');
//          this._panel.webview.postMessage({
//            type: 'resultadoIA',
//            resultado: aiResult
//          });
//        } catch (error) {
//          this._panel.webview.postMessage({
//            type: 'resultadoIA',
//            resultado: 'Erro ao consultar a IA.'
//          });
//        }
//      }
//    });
//    // 🚀 Envia nome do usuário assim que carrega
//    this.sendNomeUsuario();
//  }
//  public static async createOrShow(extensionUri: vscode.Uri) {
//    if (JiraPanel.currentPanel) {
//      JiraPanel.currentPanel._panel.reveal();
//    } else {
//      const panel = vscode.window.createWebviewPanel(
//        'jiraView',
//        'Jira',
//        vscode.ViewColumn.One,
//        { enableScripts: true }
//      );
//      JiraPanel.currentPanel = new JiraPanel(panel, extensionUri);
//    }
//  }
 
//  private async sendNomeUsuario() {
//    try {
//      const nome = await vscode.commands.executeCommand('plugin-vscode.getJiraUser');
//      this._panel.webview.postMessage({ type: 'nomeUsuario', nome });
//    } catch (error) {
//      console.error('Erro ao obter nome do usuário do Jira:', error);
//    }
//  }
//  private async handleMessage(message: any) {
//    if (message.type === 'configurarJira') {
//      vscode.window.showInformationMessage('Abrindo configuração do Jira...');
//    }
//    if (message.type === 'carregarProjetos') {
//      const projetos = await vscode.commands.executeCommand('plugin-vscode.getJiraProjects');
//      this._panel.webview.postMessage({
//        type: 'listaProjetos',
//        projetos: projetos || []
//      });
//    }
//    if (message.type === 'buscarSugestoesIssue') {
//      const { texto, projeto } = message;
//      const sugestoes = await vscode.commands.executeCommand(
//        'plugin-vscode.buscarSugestoesIssue',
//        texto,
//        projeto
//      );
//      this._panel.webview.postMessage({
//        type: 'sugestoesIssue',
//        sugestoes: sugestoes || []
//      });
//    }
//  }
// }
