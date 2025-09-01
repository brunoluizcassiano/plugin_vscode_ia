"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HomeViewProvider = void 0;
const vscode = __importStar(require("vscode"));
const homeView_1 = require("./view/homeView");
class HomeViewProvider {
    constructor(extensionUri) {
        this.extensionUri = extensionUri;
    }
    resolveWebviewView(webviewView, context, _token) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };
        webviewView.webview.html = (0, homeView_1.getHomeViewContent)();
        webviewView.webview.onDidReceiveMessage((message) => __awaiter(this, void 0, void 0, function* () {
            // Trata o botão "Jira"
            if (message.command === 'openJira') {
                vscode.commands.executeCommand('plugin-vscode.openJira');
                return;
            }
            else if (message.command === 'openZephyr') {
                vscode.commands.executeCommand('plugin-vscode.openZephyr');
                return;
            }
            else if (message.command === 'backend') {
                vscode.commands.executeCommand('plugin-vscode.backend');
                return;
            }
            else if (message.command === 'settings') {
                vscode.commands.executeCommand('plugin-vscode.settings');
                return;
            }
            if (message.type === 'navegar') {
                switch (message.destino) {
                    case 'formulario':
                        yield vscode.commands.executeCommand('backendView.focus');
                        // vscode.commands.executeCommand('homeView.removeView');
                        break;
                    case 'web':
                        yield vscode.commands.executeCommand('webTopicsView.focus');
                        // vscode.commands.executeCommand('homeView.removeView');
                        break;
                    default:
                        vscode.window.showWarningMessage(`Destino desconhecido: ${message.destino}`);
                }
            }
        }));
    }
}
exports.HomeViewProvider = HomeViewProvider;
