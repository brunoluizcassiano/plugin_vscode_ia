import * as vscode from 'vscode';
import { getHomeViewContent } from './view/homeView';
export class HomeViewProvider implements vscode.WebviewViewProvider {
    constructor(private readonly extensionUri: vscode.Uri) { }
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };
        webviewView.webview.html = getHomeViewContent();
        webviewView.webview.onDidReceiveMessage(async (message: { command?: string; type?: string; destino?: string }) => {
            // Trata o botão "Jira"
            if (message.command === 'openJira') {
                vscode.commands.executeCommand('plugin-vscode.openJira');
                return;
            } else if (message.command === 'openZephyr') {
                vscode.commands.executeCommand('plugin-vscode.openZephyr');
                return;
            } else if (message.command === 'backend') {
                vscode.commands.executeCommand('plugin-vscode.backend');
                return;
            } else if (message.command === 'settings') {
                vscode.commands.executeCommand('plugin-vscode.settings');
                return;
            }
            if (message.type === 'navegar') {
                switch (message.destino) {
                    case 'formulario':
                        await vscode.commands.executeCommand('backendView.focus');
                        // vscode.commands.executeCommand('homeView.removeView');
                        break;
                    case 'web':
                        await vscode.commands.executeCommand('webTopicsView.focus');
                        // vscode.commands.executeCommand('homeView.removeView');
                        break;
                    default:
                        vscode.window.showWarningMessage(`Destino desconhecido: ${message.destino}`);
                }
            }
        });
    }
}
