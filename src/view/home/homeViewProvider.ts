import * as vscode from 'vscode';
import { getHomeViewContent } from './homeView';

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}

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
        const webview = webviewView.webview;
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'style', 'style.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'home', 'home.js'));
        const nonce = getNonce();

        webviewView.webview.html = getHomeViewContent({
            webview,
            nonce,
            styleUri: String(styleUri),
            scriptUri: String(scriptUri)
        });
        webviewView.webview.onDidReceiveMessage(async (message: { command?: string; type?: string; destino?: string }) => {
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
                        break;
                    case 'web':
                        await vscode.commands.executeCommand('webTopicsView.focus');
                        break;
                    default:
                        vscode.window.showWarningMessage(`Destino desconhecido: ${message.destino}`);
                }
            }
        });
    }
}
