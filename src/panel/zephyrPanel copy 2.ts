import * as vscode from 'vscode';
import { getZephyrViewContent } from '../view/zephyr/zephyrView';
import { generateFeatures } from '../generators/features/featureGenerator';
import { generateSteps }    from '../generators/steps/stepsGenerator';
import path from 'path';

type Selecionado = {
  key: string;          // key do teste no Zephyr (ou "Manual_*")
  texto: string;        // Gherkin a ser usado
  issueId?: string;
  issueKey?: string;
};

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}

// ===== Helpers: aplicar filtros somente para SELECTs (sem Coverage/Owner/Label) =====
function _zNorm(v: any): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  return String(v).trim();
}
function _zEqualsCi(a: any, b: any): boolean {
  return _zNorm(a).toLowerCase() === _zNorm(b).toLowerCase();
}
function _zFrom(t: any, keys: string[], cfKeys: string[] = []): string {
  for (const k of keys) {
    const v = (t as any)?.[k];
    if (v !== undefined && v !== null && v !== '') return _zNorm(v);
  }
  const cf = (t as any)?.details?.customFields ?? (t as any)?.customFields;
  if (cf && typeof cf === 'object') {
    for (const name of cfKeys) {
      const c = (cf as any)[name] ?? (cf as any)[name?.toLowerCase?.()] ?? (cf as any)[name?.toUpperCase?.()];
      if (c !== undefined && c !== null && c !== '') return _zNorm(c);
    }
  }
  return '';
}
function _zNormAutomation(s: string): string {
  const v = _zNorm(s).toLowerCase();
  if (!v || v === 'n/a') return '';
  if (v === 'automated' || v === 'automation') return 'automated';
  if (v === 'not automated' || v === 'not automation' || v === 'manual') return 'not automated';
  if (v === 'not applicable') return 'not applicable';
  return v;
}
/**
 * Aplica SOMENTE os filtros dos SELECTs cujo valor != 'N/A'
 * Campos: automationStatus, testType, testClass, testGroup
 */
function applyZephyrSelectFilters(rawTests: any[], filtros: any): any[] {
  if (!Array.isArray(rawTests) || !filtros || typeof filtros !== 'object') return rawTests || [];

  const sel = {
    automationStatus: _zNorm((filtros as any).automationStatus),
    testType:         _zNorm((filtros as any).testType),
    testClass:        _zNorm((filtros as any).testClass),
    testGroup:        _zNorm((filtros as any).testGroup),
  };
  const use = (val: string) => (val && val.toUpperCase() !== 'N/A');

  const out: any[] = [];
  for (const t of rawTests) {
    const aut    = _zNormAutomation(_zFrom(t, ['automationStatus','automation','automated'], ['Automation status','Automation Status','Automação']));
    const ttype  = _zFrom(t, ['testType','type'], ['Test Type','Tipo']);
    const tclass = _zFrom(t, ['testClass','class'], ['Test Class','Classe']);
    const tgroup = _zFrom(t, ['testGroup','group'], ['Test Group','Grupo']);

    if (use(sel.automationStatus)) {
      const want = _zNormAutomation(sel.automationStatus);
      if (!want || want !== aut) continue;
    }
    if (use(sel.testType)  && !_zEqualsCi(ttype,  sel.testType))  continue;
    if (use(sel.testClass) && !_zEqualsCi(tclass, sel.testClass)) continue;
    if (use(sel.testGroup) && !_zEqualsCi(tgroup, sel.testGroup)) continue;

    out.push(t);
  }
  return out;
}

export class ZephyrPanel {
  public static currentPanel: ZephyrPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private issueId?: string;
  private issueKey?: string;
  private comentario?: string;
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, issueId?: string, issueKey?: string, comentario?: string) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this.issueId = issueId;
    this.issueKey = issueKey;
    this.comentario = comentario;
    const webview = this._panel.webview;

    // Gera URIs seguros para os assets da webview
    const styleUri  = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'view', 'style', 'style.css'));
    // Opcional: se mover o JS inline para arquivo externo
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'view', 'zephyr', 'zephyr.js'));
    const nonce = getNonce();

    // Passa os URIs/nonce para a view (ajuste a assinatura de getZephyrViewContent)
    this._panel.webview.html = getZephyrViewContent({
      webview,
      nonce,
      styleUri: String(styleUri),
      scriptUri: String(scriptUri)
    });
    // 🎧 Ouvindo mensagens do HTML
    this._panel.webview.onDidReceiveMessage(this.handleMessage.bind(this));
    // 🧹 Limpa referência ao fechar
    this._panel.onDidDispose(() => {
      ZephyrPanel.currentPanel = undefined;
    });
    function extrairTodosCenariosGherkin(texto: string): string[] {
      const regexBloco = /```gherkin\s+([\s\S]*?)```/gi;
      const blocos = [...texto.matchAll(regexBloco)];
      const cenarios: string[] = [];
      for (const bloco of blocos) {
        const conteudo = bloco[1]
          .split('\n')
          .map(l => l.trimStart())
          .filter(l => l.trim() !== '');
        let buffer: string[] = [];
        for (const linha of conteudo) {
          if (linha.toLowerCase().startsWith('scenario:')) {
            if (buffer.length) {
              cenarios.push(buffer.join('\n'));
              buffer = [];
            }
          }
          buffer.push(linha);
        }
        if (buffer.length) {
          cenarios.push(buffer.join('\n'));
        }
      }
      return cenarios;
    }
    function extractTestType(texto: string): string[] {
      const regex = /\*\*Test Type:\*\*\s*(.+)/g;
      const matches: string[] = [];
      let match;
      while ((match = regex.exec(texto)) !== null) {
        matches.push(match[1].trim());
      }
      return matches;
    }
    function extractTestClass(texto: string): string[] {
      const regex = /\*\*Test Class:\*\*\s*(.+)/g;
      const matches: string[] = [];
      let match;
      while ((match = regex.exec(texto)) !== null) {
        matches.push(match[1].trim());
      }
      return matches;
    }
    function extractTestGroup(texto: string): string[] {
      const regex = /\*\*Test Group:\*\*\s*(.+)/g;
      const matches: string[] = [];
      let match;
      while ((match = regex.exec(texto)) !== null) {
        matches.push(match[1].trim());
      }
      return matches;
    }
    this._panel.webview.onDidReceiveMessage(async message => {
      if (message.type === 'analisarIA') {
        try {
          const testes = message.testes || [];
          const sugestoesIA = [];
          if (testes.length === 0) {
            const resposta = await vscode.commands.executeCommand<any>(
              'plugin-vscode.criarCenariosIaQa',
              comentario || '',
              testes || ''
            );
            const respostaRaw = typeof resposta === 'string' ? resposta : (resposta?.message || 'Sem resposta da IA.');
            // Detectar se existem múltiplos cenários Gherkin
            if (respostaRaw.includes('Scenario:')) {
              const cenariosSeparados = extrairTodosCenariosGherkin(respostaRaw);
              const testTypes = extractTestType(respostaRaw);
              const testClasses = extractTestClass(respostaRaw);
              const testGroups = extractTestGroup(respostaRaw);
              cenariosSeparados.forEach((texto, idx) => {
                sugestoesIA.push({
                  key: `cenario-gerado-${idx + 1}`,
                  sugestao: texto,
                  testType: testTypes[idx] || '',
                  testClass: testClasses[idx] || '',
                  testGroup: testGroups[idx] || ''
                });
                console.log(`Cenário: ${texto}`);
                console.log(`Type: ${testTypes[idx]}`);
                console.log(`Class: ${testClasses[idx]}`);
                console.log(`Group: ${testGroups[idx]}`);
              });
            } else {
              sugestoesIA.push({
                key: 'cenario-unico',
                sugestao: respostaRaw,
                testType: extractTestType(respostaRaw)[0] || '',
                testClass: extractTestClass(respostaRaw)[0] || '',
                testGroup: extractTestGroup(respostaRaw)[0] || ''
              });
            }
          } else {
            for (const t of testes) {
              const resposta = await vscode.commands.executeCommand<any>(
                'plugin-vscode.analiseCenariosIaQa',
                comentario || '',
                t.script || ''
              );
              sugestoesIA.push({
                key: t.key,
                sugestao: typeof resposta === 'string' ? resposta : (resposta?.message || 'Sem resposta da IA.')
              });
            }
          }
          this._panel.webview.postMessage({
            type: 'sugestoesIA',
            sugestoes: sugestoesIA
          });
        } catch (error) {
          console.error('Erro ao consultar IA:', error);
          this._panel.webview.postMessage({
            type: 'sugestoesIA',
            sugestoes: []
          });
        }
      } else if (message.type === 'enviarParaZephyr') {
        const { payload } = message as {
          payload: {
            key: string,
            texto: string,
            issueId: string,
            issueKey: string,
            automationStatus: string,
            testClass: string,
            testType: string,
            testGroup: string,
            folderId: number
          }[]
        };
        try {
          const resultados = await Promise.all(
            payload.map(async ({ key, texto, automationStatus, testClass, testType, testGroup, folderId }) => {
              vscode.window.showInformationMessage(`texto: ${texto}`);
              const zephyrKey = await vscode.commands.executeCommand<string>(
                'plugin-vscode.criarTesteZephyr',
                texto,
                issueId,
                issueKey,
                automationStatus,
                testClass,
                testType,
                testGroup,
                folderId
              );
              return { key, zephyrKey };
            })
          );
          this._panel.webview.postMessage({
            type: 'atualizarCenariosComZephyrKey',
            payload: resultados,
          });
          vscode.window.showInformationMessage(`Cenários sincronizados com sucesso no Zephyr`);
        } catch (error) {
          vscode.window.showErrorMessage(`Erro ao sincronizar com Zephyr: ${error}`);
        }
      } else if (message.type === 'enviarAtualizacaoParaZephyr') {
        const { payload } = message as {
          payload: {
            key: string,
            texto: string,
            issueId: string,
            issueKey: string
          }[]
        };
        try {
          const resultados = await Promise.all(
            payload.map(async ({ key, texto, issueId, issueKey }) => {
              const zephyrKey = await vscode.commands.executeCommand<string>(
                'plugin-vscode.atualizarTesteZephyr',
                key,
                texto,
                issueId,
                issueKey
              );
              return { key, zephyrKey };
            })
          );
          // this._panel.webview.postMessage({
          //   type: 'atualizarCenariosComZephyrKey',
          //   payload: resultados,
          // });
          vscode.window.showInformationMessage(`Cenários sincronizados com sucesso no Zephyr`);
        } catch (error) {
          vscode.window.showErrorMessage(`Erro ao sincronizar com Zephyr: ${error}`);
        }
      } else if (message.type === 'carregarPastaPrincipal') {
        const issueKey = message.issueKey;
        const pastasPrincipais = await vscode.commands.executeCommand<string[]>(
          'plugin-vscode.getZephyrFolders',
          issueKey);
        this._panel.webview.postMessage({
          type: 'listaPasta',
          pastasPrincipais
        });
      } else if (message.type === 'selecionarPastaDestino') {
        const folderUri = await vscode.window.showOpenDialog({
          canSelectFolders: true,
          canSelectFiles: false,
          canSelectMany: false,
          openLabel: 'Selecionar pasta destino'
        });
        if (folderUri && folderUri[0]) {
          this._panel.webview.postMessage({
            type: 'pastaSelecionada',
            caminho: folderUri[0].fsPath
          });
        }
      } else if (message.type === 'criarScriptsEmPasta') {
        
        vscode.window.showWarningMessage(`message.dados: ${JSON.stringify(message.dados)}`);
        const caminho = message.dados.caminho;
        const itens = message.dados.itens;
        const featureName = message.dados.featureName;
        const ruleName = message.dados.ruleName;
        const fileBaseName = message.dados.fileBaseName;
        const tribeName = message.dados.tribeName;
        const extraTags = message.dados.extraTags;
  
        if (!caminho) {
          vscode.window.showWarningMessage('Selecione uma pasta de destino antes de enviar.');
          return;
        }
        if (!itens?.length) {
          vscode.window.showWarningMessage('Nenhum cenário selecionado para gerar script.');
          return;
        }
        await generateFeatures(caminho, itens, {
          featureName: featureName,
          ruleName: ruleName,
          fileBaseName: fileBaseName,
          tribeName: tribeName,
          extraTags: extraTags
         });
         await generateSteps(caminho, itens, {
          featureName: featureName,
          ruleName: ruleName,
          fileBaseName: fileBaseName,
          tribeName: tribeName,
          extraTags: extraTags
         });
      } else if (message.type === 'listarProjetosJira'){
        try {
          // Chama o comando já registrado no extension.ts
          // Ele retorna algo como: [{ key: 'ABC', name: 'Meu Projeto' }, ...]
          const projects = await vscode.commands.executeCommand<any[]>(
            'plugin-vscode.getJiraProjects'
          );

          // Devolve para a webview exatamente no formato que ela espera
          this._panel.webview.postMessage({
            type: 'projetosJira',
            projects: Array.isArray(projects) ? projects : []
          });
        } catch (err: any) {
          vscode.window.showErrorMessage(`Erro ao listar projetos do Jira: ${err?.message || err}`);
          this._panel.webview.postMessage({ type: 'projetosJira', projects: [] });
        }
      } else if (message.type === 'carregarEstruturaProjeto'){
        try {
            const projectKey: string = message.projetoIdOuKey || '';
            const resultado = await vscode.commands.executeCommand<any>(
              'plugin-vscode.getZephyrFoldersByProject',
              projectKey // já é a KEY
            );

            this._panel.webview.postMessage({
              type: 'estruturaProjeto',
              folders: resultado?.folders || [], // árvore
              flat: resultado?.flat || [],       // lista plana (se quiser usar)
              projectKey: resultado?.projectKey || projectKey
            });
          } catch (e: any) {
            vscode.window.showErrorMessage(`Erro ao carregar estrutura do projeto: ${e.message || e}`);
            this._panel.webview.postMessage({ type: 'estruturaProjeto', folders: [], flat: [], projectKey: '' });
          }
      }else if (message.type === 'aplicarFiltrosProjeto') {
        // 👉 novo caso: ao aplicar seleção, buscar "todos os testes que estão naquela pasta"
        try {
          const projectKey: string = message.projetoIdOuKey || '';
          const pastaIds: string[] = Array.isArray(message.pastaIds) ? message.pastaIds : [];
          const folderId = pastaIds[0]; // seleção única (pela UI nova)

          if (!projectKey || !folderId) {
            throw new Error('Projeto e pasta são obrigatórios.');
          }

          // Chame seu comando que retorna os testes de UMA pasta.
          // Se o seu já aceita múltiplas pastas, passe o array completo.
          // Ajuste o nome do command se o seu for diferente.
          const rawTests = await vscode.commands.executeCommand<any[]>(
            'plugin-vscode.getZephyrTestsByFolder',
            projectKey,
            folderId,
            { recursive: false } // se quiser incluir subpastas, troque para true no seu command
          );

          const filtros = (message && (message as any).filtros) ? (message as any).filtros : {};
          const _raw = Array.isArray(rawTests) ? rawTests : [];
          const testesZephyr = applyZephyrSelectFilters(_raw, filtros).map(mapZephyrTestsForWebview);

          // Enviamos direto no formato que a webview já trata e renderiza
          this._panel.webview.postMessage({
            type: 'zephyrDataProjeto',
            zephyrDataProjeto: { testesZephyr },
            projectKey,
            folderId
          });
        } catch (e: any) {
          vscode.window.showErrorMessage(`Erro ao carregar testes da pasta: ${e?.message || e}`);
          this._panel.webview.postMessage({
            type: 'zephyrDataProjeto',
            zephyrDataProjeto: { testesZephyr: [] },
            projectKey: message.projetoIdOuKey || '',
            folderId: (Array.isArray(message.pastaIds) && message.pastaIds[0]) || null
          });
        }
      }
    });
    // Envia nome do usuário assim que carrega
    this.sendNomeUsuario();
    // Envia dados do Zephyr
    this.zephyr(issueId, issueKey, comentario);
  }
  public static async createOrShow(extensionUri: vscode.Uri, issueId?: string, issueKey?: string, comentario?: string | undefined) {
    const column = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;
    if (ZephyrPanel.currentPanel) {
      ZephyrPanel.currentPanel._panel.reveal(column);
      // Se a issueKey for diferente, atualiza
      if (ZephyrPanel.currentPanel.issueKey !== issueKey) {
        ZephyrPanel.currentPanel.issueKey = issueKey;
        // Limpa estado da tela e reinicia o carregamento
        ZephyrPanel.currentPanel._panel.webview.postMessage({
          type: 'novoId',
          issueKey,
          comentario
        });
        // Reenvia os dados com novo issueKey
        ZephyrPanel.currentPanel.sendNomeUsuario();
        ZephyrPanel.currentPanel.zephyr(issueId, issueKey, comentario);
      }
    } else {
      const panel = vscode.window.createWebviewPanel(
      'zephyrView',
      'Zephyr',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true, // preserva DOM/JS ao trocar de aba
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'src', 'view', 'style'),
          vscode.Uri.joinPath(extensionUri, 'src', 'view', 'zephyr'),
          vscode.Uri.joinPath(extensionUri, 'media'), // se no futuro mover assets para /media
          vscode.Uri.joinPath(extensionUri, 'out'),   // se gerar bundles
        ],
      }
    );
      ZephyrPanel.currentPanel = new ZephyrPanel(panel, extensionUri, issueId, issueKey, comentario);
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
  private async zephyr(issueId?: string, issueKey?: string, comentario?: string) {
    try {
      const zephyrData = await vscode.commands.executeCommand('plugin-vscode.getZephyrTestToIssue', issueKey);
      this._panel.webview.postMessage({ type: 'zephyrData', issueId, issueKey, zephyrData, comentario });
    } catch (error) {
      console.error('Erro ao obter dados do Zephyr:', error);
    }
  }
  private async handleMessage(message: any) {
    if (message.type === 'buscarIssue') {
      const { key } = message;
      const issue = await vscode.commands.executeCommand(
        'plugin-vscode.getZephyrTestToIssue',
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
    }
  }  
}

// (opcional, mas recomendado) — normaliza o shape dos testes pro que a webview espera
function mapZephyrTestsForWebview(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  // Ajuste aqui conforme o shape real dos testes vindos do seu command
  return {
    key: raw.key ?? raw.testKey ?? raw.name ?? 'SemKey',
    version: raw.version ?? raw.versionNumber ?? 1,
    details: {
      name: raw.details?.name ?? raw.name ?? '',
      customFields: raw.details?.customFields ?? raw.customFields ?? {}
    },
    script: raw.script ?? raw.steps?.gherkin ?? raw.steps ?? ''
  };
}
