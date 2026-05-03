import fetch from 'node-fetch';
import * as vscode from 'vscode';
import { HomeActionsProvider } from './view/home/homeActionsProvider';
import { JiraPanel } from './panel/jiraPanel';
import { ZephyrPanel } from './panel/zephyrPanel';
import { BackendPanel } from './panel/backendPanel';
import { SettingsPanel } from './panel/settingsPanel';
import { askLanguageModel } from './ai/model/languageModelBridge';
import { ArtifactsTreeProvider } from './view/project/artifactsTreeProvider';
import { ProjectStatusProvider } from './view/project/projectStatusProvider';
import { CypressTestsProvider } from './view/project/cypressTestsProvider';
import { findCypressProjectRoot } from './view/project/cypressProject';

import {
  buildAnaliseStoryEpicFunPrompt,
  buildAnaliseCenarioPrompt,
  buildCriarCenariosPrompt,
} from './ai/prompts';

let globalToken: string | null = null;
let globalThreadId: string | null = null;

// === GitHub Login: helpers/estado ===
const GH_SCOPES = ['read:user', 'user:email'];
let ghStatusItem: vscode.StatusBarItem | undefined;

interface GitHubUser {
 login: string;
 name?: string;
 email?: string;
 avatar_url?: string;
 html_url?: string;
 id?: number;
}

function getStoredGitHubUser(context: vscode.ExtensionContext): GitHubUser | undefined {
 return context.globalState.get<GitHubUser>('plugin.github.user');
}

function getGitHubUserFromSession(session: vscode.AuthenticationSession): GitHubUser {
 const label = String(session.account.label || '').trim();
 const looksLikeEmail = label.includes('@');
 return {
   login: label || session.account.id,
   name: looksLikeEmail ? undefined : label || undefined,
   email: looksLikeEmail ? label : undefined,
 };
}

async function fetchGitHubUser(session: vscode.AuthenticationSession): Promise<GitHubUser> {
 const headers = { Authorization: `Bearer ${session.accessToken}`, Accept: 'application/vnd.github+json' };
 const userRes = await fetch('https://api.github.com/user', { headers });

 if (!userRes.ok) {
   if (userRes.status === 401 || userRes.status === 403) {
     return getGitHubUserFromSession(session);
   }
   throw new Error(`Falha ao obter usuário do GitHub: ${userRes.status}`);
 }

 const user = await userRes.json();
 let email: string | undefined = user.email;

 if (!email) {
   const emailRes = await fetch('https://api.github.com/user/emails', { headers });
   if (emailRes.ok) {
     const emails = await emailRes.json();
     const primary = Array.isArray(emails) ? emails.find((e: any) => e.primary) : undefined;
     email = primary?.email || emails?.[0]?.email;
   }
 }

 return {
   login: user.login,
   name: user.name || undefined,
   email,
   avatar_url: user.avatar_url || undefined,
   html_url: user.html_url || undefined,
   id: user.id || undefined,
 };
}

function showOrUpdateGitHubStatus(user?: GitHubUser) {
 if (!ghStatusItem) {
   ghStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
   ghStatusItem.command = 'plugin-vscode.refreshGitHubSession';
 }

 if (user?.login) {
   ghStatusItem.text = `$(github) ${user.login}`;
   ghStatusItem.tooltip = user.name ? `GitHub: ${user.name}` : 'GitHub conectado';
 } else {
   ghStatusItem.text = '$(github) Entrar no GitHub';
   ghStatusItem.tooltip = 'Clique para conectar sua conta do GitHub';
 }

 ghStatusItem.show();
}

async function ensureGitHubSession(opts?: { interactive?: boolean; silent?: boolean }): Promise<vscode.AuthenticationSession | undefined> {
 const interactive = !!opts?.interactive;
 const silent = !!opts?.silent;
 // 1) Tenta silencioso primeiro (não abre UI)
 if (silent) {
   const s = await vscode.authentication.getSession('github', GH_SCOPES, { createIfNone: false, silent: true });
   if (s) return s;
 }
 // 2) Se pedir interativo, força criar sessão (abre UI de login)
 if (interactive) {
   return vscode.authentication.getSession('github', GH_SCOPES, { createIfNone: true });
 }
 // 3) Por padrão, tenta pegar sem criar (não abre UI)
 return vscode.authentication.getSession('github', GH_SCOPES, { createIfNone: false });
}

async function identifyGitHubOnStartup(context: vscode.ExtensionContext) {
 const aiProvider = vscode.workspace.getConfiguration().get<string>('plugin.ai.provider', 'auto');
 if (aiProvider !== 'copilot') {
   showOrUpdateGitHubStatus(undefined);
   return;
 }

 try {
   // tenta silencioso
   let session = await ensureGitHubSession({ silent: true });
   if (!session) {
     // Oferece entrar agora para não "forçar" popup automaticamente
     const choice = await vscode.window.showInformationMessage(
       'Para personalizar a experiência, conecte seu GitHub.',
       'Entrar no GitHub',
       'Agora não'
     );
     if (choice === 'Entrar no GitHub') {
       session = await ensureGitHubSession({ interactive: true });
     }
   }
   if (session) {
     const ghUser = await fetchGitHubUser(session);
     await context.globalState.update('plugin.github.user', ghUser);
     
     console.log('&#x1f510; GitHub conectado como:', ghUser.login);
     console.log('&#x1f510; GitHub conectado com accessToken:', session.accessToken);
     showOrUpdateGitHubStatus(ghUser);
   } else {
     // sem sessão
     await context.globalState.update('plugin.github.user', undefined);
     showOrUpdateGitHubStatus(undefined);
   }
 } catch (err: any) {
   console.warn('⚠️ Não foi possível identificar o login do GitHub:', err?.message || err);
   showOrUpdateGitHubStatus(undefined);
 }
}

// --- De/Para helpers ---
type ProjectMapValue = string | { zephyrKey: string; zephyrProjectId?: string };

function getProjectMap(): Record<string, ProjectMapValue> {
 return vscode.workspace.getConfiguration().get<Record<string, ProjectMapValue>>('plugin.projectMap', {});
}

function getStrict(): boolean {
 return vscode.workspace.getConfiguration().get<boolean>('plugin.projectMap.strict', false);
}

function jiraKeyFrom(input: string): string {
 const k = (input || '').includes('-') ? input.split('-')[0] : input;
 return (k || '').trim().toUpperCase();
}

/** Resolve projeto Zephyr a partir de issueKey/projeto. Não lança; devolve null se não conseguir. */
function tryResolveZephyrProject(input: string): { zephyrKey: string; zephyrProjectId?: string } | null {
 const jiraKey = jiraKeyFrom(input);
 if (!jiraKey) return null;
 const map = getProjectMap();
 const raw = map[jiraKey];
 if (!raw) {
   if (getStrict()) return null;                   // strict ligado e sem de/para → pedir ação ao usuário
   return { zephyrKey: jiraKey };                  // fallback: usa o próprio key do Jira
 }
 if (typeof raw === 'string') return { zephyrKey: raw.toUpperCase() };
 return {
   zephyrKey: String(raw.zephyrKey || jiraKey).toUpperCase(),
   zephyrProjectId: raw.zephyrProjectId
 };
}

function resolveZephyrProjectOrThrow(originLabel: string, issueOrProject?: string) {
 const project = tryResolveZephyrProject(issueOrProject ?? '');
 if (project) return project;
 throw new Error(`[${originLabel}] Não foi possível resolver o projeto Zephyr a partir de "${issueOrProject ?? ''}".`);
}

/** Se não der para resolver, pergunta ao usuário (input + botões). */
async function resolveProjectOrPrompt(originLabel: string, issueOrProject?: string) {
 let project = tryResolveZephyrProject(issueOrProject ?? '');
 if (project) return project;
 const jiraKey = jiraKeyFrom(issueOrProject ?? '');
 const opts = ['Informar projeto…', 'Abrir Settings', getStrict() ? 'Desativar strict agora' : undefined]
   .filter(Boolean) as string[];
 const pick = await vscode.window.showWarningMessage(
   `Projeto ${jiraKey ? `'${jiraKey}'` : '(vazio)'} sem de/para e modo estrito ${getStrict() ? 'ligado' : 'desligado'}.`,
   ...opts
 );
 if (pick === 'Desativar strict agora') {
   await vscode.workspace.getConfiguration().update('plugin.projectMap.strict', false, vscode.ConfigurationTarget.Global);
   project = tryResolveZephyrProject(issueOrProject ?? '');
   if (project) return project;
 }
 if (pick === 'Abrir Settings') {
   await vscode.commands.executeCommand('workbench.action.openSettingsJson');
   throw new Error(`[${originLabel}] Ação cancelada: abra as configurações e crie o de/para.`);
 }
 if (pick === 'Informar projeto…') {
   const typed = await vscode.window.showInputBox({
     prompt: 'Informe o key do projeto Jira (ex.: TBTX) ou uma issue (ex.: TBTX-123)',
     placeHolder: 'TBTX ou TBTX-123',
     ignoreFocusOut: true
   });
   project = tryResolveZephyrProject(typed ?? '');
   if (!project) throw new Error(`[${originLabel}] Não foi possível resolver o projeto a partir de "${typed ?? ''}".`);
   return project;
 }
 throw new Error(`[${originLabel}] Ação cancelada pelo usuário.`);
}

/** Monta URL com projectKey ou projectId, conforme disponível. */
function withProjectParam(baseUrl: string, project: { zephyrKey: string; zephyrProjectId?: string }) {
 const url = new URL(baseUrl);
 if (project.zephyrProjectId) url.searchParams.set('projectId', String(project.zephyrProjectId));
 else url.searchParams.set('projectKey', project.zephyrKey);
 return url.toString();
}

function runCypressTerminal(command: 'open' | 'run') {
  const root = findCypressProjectRoot();
  if (!root) {
    vscode.window.showWarningMessage('Nenhum projeto Cypress encontrado no workspace.');
    return;
  }

  const terminal = vscode.window.createTerminal({
    name: command === 'open' ? 'Cypress Open' : 'Cypress Run',
    cwd: root,
  });
  terminal.show();
  terminal.sendText(`npx cypress ${command}`);
}

export async function activate(context: vscode.ExtensionContext) {
  console.log('✅ Plugin "Form Plugin" está sendo ativado...');

  const homeActionsProvider = new HomeActionsProvider();
  const artifactsTreeProvider = new ArtifactsTreeProvider();
  const cypressTestsProvider = new CypressTestsProvider();
  const projectStatusProvider = new ProjectStatusProvider();
  
  context.subscriptions.push(
    vscode.window.createTreeView('homeView', {
      treeDataProvider: homeActionsProvider,
    }),
    vscode.window.createTreeView('qualityArtifactsView', {
      treeDataProvider: artifactsTreeProvider,
      showCollapseAll: true,
    }),
    vscode.window.createTreeView('qualityTestsView', {
      treeDataProvider: cypressTestsProvider,
      showCollapseAll: true,
    }),
    vscode.window.createTreeView('qualityProjectStatusView', {
      treeDataProvider: projectStatusProvider,
      showCollapseAll: true,
    }),
    vscode.commands.registerCommand('plugin-vscode.refreshArtifacts', () => artifactsTreeProvider.refresh()),
    vscode.commands.registerCommand('plugin-vscode.refreshTests', () => cypressTestsProvider.refresh()),
    vscode.commands.registerCommand('plugin-vscode.cypressOpen', () => runCypressTerminal('open')),
    vscode.commands.registerCommand('plugin-vscode.cypressRun', () => runCypressTerminal('run')),
    vscode.commands.registerCommand('plugin-vscode.refreshProjectStatus', () => projectStatusProvider.refresh())
  );
  void cypressTestsProvider.refresh();
  void projectStatusProvider.refresh();

  console.log('✅ Views do QE Studio registradas.');
  // === GitHub Login: identifica somente quando Copilot estiver selecionado
  void identifyGitHubOnStartup(context);
  // Observa mudanças na sessão do GitHub (login/logout em outro lugar)
   context.subscriptions.push(
     vscode.authentication.onDidChangeSessions(async (e) => {
       if (e.provider.id === 'github') {
         await identifyGitHubOnStartup(context);
       }
     })
   );

  // O foco da visualização deve ser feito manualmente ou em resposta a um comando.
  // Por padrão não forçamos a abertura/foco da view ao iniciar — controlado por plugin.openOnStart
  try {
    const openOnStart = vscode.workspace.getConfiguration().get<boolean>('plugin.openOnStart', false);
    if (openOnStart) {
      await vscode.commands.executeCommand('workbench.view.extension.formSidebar');
      await vscode.commands.executeCommand('homeView.focus', { preserveFocus: true });
    }
  } catch (e) {
    // não bloquear ativação em caso de erro ao ler config
    console.warn('Erro ao checar plugin.openOnStart:', e);
  }

  // Registro dos comandos
  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.openJira', () => {
      JiraPanel.createOrShow(context.extensionUri);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.openZephyr', (issueId?: string, issueKey?: string, comentario?: string, description?: string, bddSpecification?: string) => {
      if (!comentario) {
        comentario = `Descrição:\n${description}\n\nEspecificação BDD:\n${bddSpecification}`;
      }
      ZephyrPanel.createOrShow(context.extensionUri, issueId, issueKey, comentario);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.backend', () => {
      BackendPanel.createOrShow(context.extensionUri);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.openWebFlow', async () => {
      try {
        await vscode.commands.executeCommand('webTopicsView.focus');
      } catch {
        vscode.window.showInformationMessage('Fluxo Web ainda não possui uma visão registrada.');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.settings', () => {
      SettingsPanel.createOrShow(context.extensionUri);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.refreshGitHubSession', async () => {
      try {
        const session = await ensureGitHubSession({ interactive: true });
        if (!session) {
          await context.globalState.update('plugin.github.user', undefined);
          showOrUpdateGitHubStatus(undefined);
          return;
        }
        const ghUser = await fetchGitHubUser(session);
        await context.globalState.update('plugin.github.user', ghUser);
        showOrUpdateGitHubStatus(ghUser);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Erro ao atualizar sessão do GitHub: ${err?.message || err}`);
        showOrUpdateGitHubStatus(getStoredGitHubUser(context));
      }
    })
  );

  // Comando para obter o nome do usuário logado no Jira
  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.getJiraUser', async () => {
      const { jiraDomain, jiraEmail, jiraToken } = getJiraSettings();
      const auth = encodeAuth(jiraEmail, jiraToken);
      try {
        const response = await fetch(`https://${jiraDomain}/rest/api/2/myself`, {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
          },
        });
        const data = await response.json();
        return data.displayName || data.name;
      } catch (err: any) {
        vscode.window.showErrorMessage('Erro ao conectar no Jira: ' + err.message);
        return 'usuário';
      }
    })
  );

  // Projetos Jira (exemplo com filtro fixo que você usa)
  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.getJiraProjects', async () => {
      const { jiraDomain, jiraEmail, jiraToken, jiraProjectCategoryId } = getJiraSettings();
      const auth = encodeAuth(jiraEmail, jiraToken);
      try {
        const projectUrl = jiraProjectCategoryId
          ? `https://${jiraDomain}/rest/api/3/project/search?categoryId=${encodeURIComponent(jiraProjectCategoryId)}`
          : `https://${jiraDomain}/rest/api/3/project`;

        const response = await fetch(projectUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
          },
        });
        const data = await response.json();
        const projects = Array.isArray(data?.values)
          ? data.values
          : Array.isArray(data)
            ? data
            : [];
        return projects.map((p: any) => ({ key: p.key, name: p.name }));
        // return data.map((p: any) => ({ key: p.key, name: p.name }));
      } catch (err: any) {
        vscode.window.showErrorMessage(`Erro ao buscar projetos do Jira: ${err?.message || err}`);
        return [];
      }
    })
  );

  //Método para enviar comentário para a issue:
  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.enviarComentarioIssue', async (issueKey: string, comentario: string) => {
      const { jiraDomain, jiraEmail, jiraToken } = getJiraSettings();
      const auth = encodeAuth(jiraEmail, jiraToken);
      const url = `https://${jiraDomain}/rest/api/2/issue/${issueKey}/comment`;
      const body = JSON.stringify({
        body: comentario,
      });
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body,
        });
        if (!response.ok) {
          const erroTexto = await response.text();
          throw new Error(`Erro ao enviar comentário: ${response.status} - ${erroTexto}`);
        }
        vscode.window.showInformationMessage(`✅ Comentário enviado com sucesso para a issue ${issueKey}`);
      } catch (err: any) {
        vscode.window.showErrorMessage(`❌ Falha ao enviar comentário para a issue ${issueKey}: ${err.message}`);
      }
    })
  );

  //Comando para buscar sugestões de issues com base no summary
  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.buscarSugestoesIssue', async (texto: string, projectKey?: string) => {
      const { jiraDomain, jiraEmail, jiraToken } = getJiraSettings();
      const auth = encodeAuth(jiraEmail, jiraToken);
      const term = (texto || '').trim();
      // Tipos permitidos
      const allowedTypesJQL = 'issuetype in ("Functionality", "Funcionalidade", "Epic","Story", "História")';
      const isFullKey = /^[A-Z][A-Z0-9_]*-\d+$/i.test(term);
      try {
        if (isFullKey) {
          // match exato de chave + filtro por tipo
          const jql = `key = "${term.toUpperCase()}" AND ${allowedTypesJQL}`;
          const url = `https://${jiraDomain}/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=5&fields=key,summary`;
          const res = await fetch(url, { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } });
          const json = await res.json();
          return (json.issues || []).map((i: any) => ({ key: i.key, summary: i.fields.summary || '' }));
        } else {
          // sugestões parciais (prefixo de chave ou parte do título) + filtro por tipo
          const scopeJQL = [
            projectKey ? `project = ${projectKey}` : null,
            allowedTypesJQL
          ].filter(Boolean).join(' AND ');
          const url =
            `https://${jiraDomain}/rest/api/2/issue/picker` +
            `?query=${encodeURIComponent(term)}` +
            (scopeJQL ? `&currentJQL=${encodeURIComponent(scopeJQL)}` : '');
          const res = await fetch(url, { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } });
          const data = await res.json();
          const issues = (data?.sections || []).flatMap((s: any) => s.issues || []);
          const uniqueIssues = Array.from(
            new Map(issues.map((i: any) => [String(i.key || '').toUpperCase(), i])).values()
          );
          return uniqueIssues.slice(0, 10).map((i: any) => ({
            key: i.key,
            summary: i.summary || i.summaryText || i.label || ''
          }));
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(`Erro ao buscar sugestões do Jira: ${err.message}`);
        return [];
      }
    })
  );

  // Novo comando: buscar detalhes completos da issue
  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.getJiraIssue', async (issueKey: string) => {
      const { jiraDomain, jiraEmail, jiraToken } = getJiraSettings();
      const { zephyrDomain, zephyrToken } = getZephyrSettings();
      const auth = encodeAuth(jiraEmail, jiraToken);
      const url = `https://${jiraDomain}/rest/api/2/issue/${issueKey}`;
      try {
        const response = await fetch(url, {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
          },
        });
        if (!response.ok) return null;
        const data = await response.json();
        // Verificar se o tipo da issue é permitido
        const tipo = data.fields.issuetype.name;
        const tiposPermitidos = ['Functionality', 'Funcionalidade', 'Epic', 'Story', "História"];
        if (!tiposPermitidos.includes(tipo)) {
          vscode.window.showErrorMessage(`Tipo de issue "${tipo}" não suportado para esta funcionalidade.`);
          return null;
        }
        // Retorno final com todos os dados da issue e scripts
        return {
          id: data.id,
          key: data.key,
          issuetype: data.fields.issuetype.name,
          summary: data.fields.summary,
          description: data.fields.description,
          bddSpecification: data.fields.customfield_10553,
          status: data.fields.status?.name || 'Sem status',
          assignee: data.fields.assignee?.displayName || 'Não atribuído',
          reporter: data.fields.reporter?.displayName || 'Desconhecido',
          attachments: (data.fields.attachment || []).map((att: any) => ({
            filename: att.filename,
            url: att.content
          }))
        };
      } catch (err: any) {
        vscode.window.showErrorMessage(`Erro ao buscar detalhes da issue: ${err.message}`);
        return null;
      }
    })
  );

  // ✅ Novo comando: buscar detalhes completos da issue
  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.getZephyrTestToIssue', async (issueKey: string) => {
      const { zephyrToken, zephyrDomain } = getZephyrSettings();
      const url = `https://${zephyrDomain}/v2/issuelinks/${issueKey}/testcases`;
      // Buscar testes vinculados no Zephyr
      let zephyrData: any = { values: [] };
      try {
        const zephyrRes = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${zephyrToken}`,
            'Accept': 'application/json',
          }
        });
        console.log('&#x1f50d; Zephyr issuelinks status:', zephyrRes.status, zephyrRes.statusText, 'issueKey=', issueKey);
        if (zephyrRes.ok) {
          zephyrData = await zephyrRes.json();
          console.log('&#x1f50d; Dados do zephyr:', JSON.stringify(zephyrData, null, 2));
          console.log('&#x1f50d; Zephyr issuelinks shape:', Array.isArray(zephyrData)
            ? { root: 'array', count: zephyrData.length }
            : {
                root: typeof zephyrData,
                keys: Object.keys(zephyrData || {}),
                valuesCount: Array.isArray(zephyrData?.values) ? zephyrData.values.length : null,
                itemsCount: Array.isArray(zephyrData?.items) ? zephyrData.items.length : null,
                contentCount: Array.isArray(zephyrData?.content) ? zephyrData.content.length : null,
                resultsCount: Array.isArray(zephyrData?.results) ? zephyrData.results.length : null,
                testCasesCount: Array.isArray(zephyrData?.testCases) ? zephyrData.testCases.length : null,
                testcasesCount: Array.isArray(zephyrData?.testcases) ? zephyrData.testcases.length : null,
              });
        } else {
          console.warn('⚠️ Zephyr issuelinks request failed for', issueKey, 'status=', zephyrRes.status, zephyrRes.statusText);
        }
      } catch (zephyrErr: any) {
        console.warn('Erro ao buscar testes no Zephyr:', zephyrErr.message);
      }
      // Função para buscar os scripts de cada test case
      const fetchTestScripts = async (testcases: any[]): Promise<any[]> => {
        const scripts: any[] = [];
        for (const test of testcases) {
          try {
            const scriptRes = await fetch(`https://${zephyrDomain}/v2/testcases/${test.key}/testscript`, {
              headers: {
                Authorization: `Bearer ${zephyrToken}`,
                Accept: 'application/json',
              }
            });
            const scriptDetails = await fetch(`https://${zephyrDomain}/v2/testcases/${test.key}`, {
              headers: {
                Authorization: `Bearer ${zephyrToken}`,
                Accept: 'application/json',
              }
            });
            if (!scriptRes.ok) {
              scripts.push({
                key: test.key,
                version: test.version,
                script: '⚠️ Não foi possível buscar o script.'
              });
              continue;
            }
            if (!scriptDetails.ok) {
              scripts.push({
                key: test.key,
                version: test.version,
                script: '⚠️ Não foi possível buscar o detalhe do cenário.'
              });
              continue;
            }
            const scriptData = await scriptRes.json();
            const detailsData = await scriptDetails.json();
            scripts.push({
              key: test.key,
              version: test.version,
              script: scriptData.text || '<i>Sem conteúdo</i>',
              details: detailsData || '<i>Sem conteúdo</i>'
            });
          } catch (err) {
            scripts.push({
              key: test.key,
              version: test.version,
              script: '⚠️ Erro ao buscar o script.',
              details: '⚠️ Erro ao buscar o detalhe do cenário.'
            });
          }
        }
        return scripts;
      };
      const testcases = Array.isArray(zephyrData)
        ? zephyrData
        : Array.isArray(zephyrData?.values)
          ? zephyrData.values
          : Array.isArray(zephyrData?.items)
            ? zephyrData.items
            : Array.isArray(zephyrData?.content)
              ? zephyrData.content
              : [];
      console.log('&#x1f50d; Zephyr issuelinks normalized testcases count:', testcases.length);
      const testesZephyr = await fetchTestScripts(testcases);
      console.log('&#x1f50d; Dados do zephyr:', JSON.stringify(testesZephyr, null, 2));
      // Retorno final com todos os dados da issue e scripts
      return {
        key: issueKey,
        testesZephyr,
      };
    })
  );

  // Estrutura de pastas do Zephyr por projectKey
  context.subscriptions.push(
    // &#x1f50e; Estrutura de pastas do Zephyr por projectKey (sem resolver ID)
    vscode.commands.registerCommand('plugin-vscode.getZephyrFoldersByProject', async (projectKeyParam: string) => {
      const { zephyrToken, zephyrDomain } = getZephyrSettings();
      try {
        // ✅ Resolve via de/para; se faltar, pergunta ao usuário
        const projectKey = await resolveProjectOrPrompt('Listar pastas', projectKeyParam);
        if (!projectKey) throw new Error('Project key não informada.');
        const requestedProjectKey = jiraKeyFrom(projectKeyParam);
        let startAt = 0;
        const maxResults = 100;
        let isLast = false;
        const allFolders: Array<{ id: number; parentId: number | null; name: string }> = [];
        while (!isLast) {
          const base = `https://${zephyrDomain}/v2/folders`;
          const url = withProjectParam(base, projectKey) +
                      `&maxResults=${maxResults}&startAt=${startAt}&folderType=TEST_CASE`;
                      console.log('&#x1f50d; Zephyr folders URL:', url);
          const res = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${zephyrToken}`,
              'Accept': 'application/json',
            }
          });
          if (!res.ok) {
            const t = await res.text();
            throw new Error(`Falha ao listar pastas: ${res.status} - ${t}`);
          }
          const json = await res.json();
          const values = Array.isArray(json?.values) ? json.values : [];
          values.forEach((p: any) => {
            allFolders.push({
              id: Number(p.id),
              parentId: (p.parentId == null ? null : Number(p.parentId)),
              name: String(p.name || ''),
            });
          });
          isLast = !!json.isLast;
          startAt += maxResults;
        }
        // monta árvore (inline — sem helper separado)
        const byId = new Map<number, any>();
        const roots: any[] = [];
        allFolders.forEach(f => byId.set(f.id, { id: f.id, name: f.name, children: [] as any[] }));
        allFolders.forEach(f => {
          const node = byId.get(f.id);
          if (f.parentId && byId.has(f.parentId)) {
            byId.get(f.parentId).children.push(node);
          } else {
            roots.push(node);
          }
        });
        return { requestedProjectKey, projectKey: projectKey.zephyrKey, project: projectKey, folders: roots, flat: allFolders };
      } catch (err: any) {
        vscode.window.showErrorMessage(`Erro ao carregar pastas do Zephyr: ${err.message}`);
        return { requestedProjectKey: '', projectKey: '', project: null, folders: [], flat: [] };
      }
    })
  );

  // Lista os testes de uma pasta do Zephyr (sem recursão por padrão)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'plugin-vscode.getZephyrTestsByFolder',
      async (
        projectKey: string,
        folderId: string | number,
        opts?: { maxResults?: number } // pode expandir se quiser recursion mais tarde
      ) => {
        const { zephyrToken, zephyrDomain } = getZephyrSettings();
        const maxResults = opts?.maxResults ?? 100;
        // ✅ Resolve via de/para; se faltar, pergunta ao usuário
        const project = await resolveProjectOrPrompt('Listar pastas', projectKey);
        if (!project || !folderId) {
          vscode.window.showErrorMessage('Projeto e pasta são obrigatórios.');
          return [];
        }
        // 1) Paginação para buscar todos os test cases da PASTA
        let startAt = 0;
        let isLast = false;
        const allTests: any[] = [];
        try {
          while (!isLast) {
            // const url = `https://${zephyrDomain}/v2/testcases` +
            //   `?projectKey=${encodeURIComponent(projectKey)}` +
            //   `&folderId=${encodeURIComponent(String(folderId))}` +
            //   `&maxResults=${maxResults}` +
            //   `&startAt=${startAt}`;
            
            const base = `https://${zephyrDomain}/v2/testcases`;
            const url = withProjectParam(base, project) +
                        `&folderId=${encodeURIComponent(String(folderId))}` +
                        `&maxResults=${maxResults}` +
                        `&startAt=${startAt}`;
                        console.log('&#x1f50d; Zephyr folders URL:', url);
            const res = await fetch(url, {
              headers: {
                'Authorization': `Bearer ${zephyrToken}`,
                'Accept': 'application/json',
              }
            });
            if (!res.ok) {
              const txt = await res.text();
              throw new Error(`Falha ao listar test cases da pasta: ${res.status} - ${txt}`);
            }
            const json = await res.json();
            const values = Array.isArray(json.values) ? json.values : [];
            allTests.push(...values);
            isLast = !!json.isLast || values.length === 0;
            startAt += maxResults;
          }
        } catch (err: any) {
          vscode.window.showErrorMessage(`Erro ao buscar testes da pasta no Zephyr: ${err.message}`);
          return [];
        }
        // 2) Para cada test case, buscar detalhes e script (mantém padrão do seu código)
        const out: any[] = [];
        for (const t of allTests) {
          const key = t.key || t.testCaseKey || t.name || '';
          if (!key) continue;
          // detalhes
          let details: any = {};
          try {
            const detRes = await fetch(`https://${zephyrDomain}/v2/testcases/${encodeURIComponent(key)}`, {
              headers: {
                'Authorization': `Bearer ${zephyrToken}`,
                'Accept': 'application/json',
              }
            });
            if (detRes.ok) {
              details = await detRes.json();
            }
          } catch (e: any) {
            console.warn(`⚠️ Falha ao buscar detalhes do teste ${key}:`, e?.message || e);
          }
          // script (gherkin)
          let script = '';
          try {
            const scriptRes = await fetch(`https://${zephyrDomain}/v2/testcases/${encodeURIComponent(key)}/testscript`, {
              headers: {
                'Authorization': `Bearer ${zephyrToken}`,
                'Accept': 'application/json',
              }
            });
            if (scriptRes.ok) {
              const s = await scriptRes.json();
              script = s?.text || '';
            }
          } catch (e: any) {
            console.warn(`⚠️ Falha ao buscar script do teste ${key}:`, e?.message || e);
          }
          out.push({
            key,
            version: t.version ?? details?.version ?? 1,
            details,
            script
          });
        }
        // 3) Retorna para o panel (quem chamou via executeCommand)
        return out;
      }
    )
  );

  // Novo comando: buscar detalhes completos da issue
  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.getJiraIssueDetails', async (issueKey: string) => {
      const { jiraDomain, jiraEmail, jiraToken } = getJiraSettings();
      const { zephyrToken, zephyrDomain } = getZephyrSettings();
      const auth = encodeAuth(jiraEmail, jiraToken);
      const url = `https://${jiraDomain}/rest/api/2/issue/${issueKey}`;
      try {
        const response = await fetch(url, {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
          },
        });
        if (!response.ok) return null;
        const data = await response.json();
        console.log('&#x1f50d; Dados da issue:', JSON.stringify(data, null, 2));
        // Buscar testes vinculados no Zephyr
        let zephyrData: any = { values: [] };
        try {
          const zephyrRes = await fetch(`https://${zephyrDomain}/v2/issuelinks/${issueKey}/testcases`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${zephyrToken}`,
              'Accept': 'application/json',
            }
          });
          if (zephyrRes.ok) {
            zephyrData = await zephyrRes.json();
            console.log('&#x1f50d; Dados do zephyr:', JSON.stringify(zephyrData, null, 2));
          }
        } catch (zephyrErr: any) {
          console.warn('Erro ao buscar testes no Zephyr:', zephyrErr.message);
        }
        // Função para buscar os scripts de cada test case
        const fetchTestScripts = async (testcases: any[]): Promise<any[]> => {
          const scripts: any[] = [];
          for (const test of testcases) {
            try {
              const scriptRes = await fetch(`https://${zephyrDomain}/v2/testcases/${test.key}/testscript`, {
                headers: {
                  Authorization: `Bearer ${zephyrToken}`,
                  Accept: 'application/json',
                }
              });
              if (!scriptRes.ok) {
                scripts.push({
                  key: test.key,
                  version: test.version,
                  script: '⚠️ Não foi possível buscar o script.'
                });
                continue;
              }
              const scriptData = await scriptRes.json();
              scripts.push({
                key: test.key,
                version: test.version,
                script: scriptData.text || '<i>Sem conteúdo</i>',
              });
            } catch (err) {
              scripts.push({
                key: test.key,
                version: test.version,
                script: '⚠️ Erro ao buscar o script.',
              });
            }
          }
          return scripts;
        };
        const testcases = Array.isArray(zephyrData) ? zephyrData : [];
        const testesZephyr = await fetchTestScripts(testcases);
        // Retorno final com todos os dados da issue e scripts
        return {
          key: data.key,
          issuetype: data.fields.issuetype.name,
          summary: data.fields.summary,
          description: data.fields.description,
          bddSpecification: data.fields.customfield_10553,
          status: data.fields.status?.name || 'Sem status',
          assignee: data.fields.assignee?.displayName || 'Não atribuído',
          reporter: data.fields.reporter?.displayName || 'Desconhecido',
          attachments: (data.fields.attachment || []).map((att: any) => ({
            filename: att.filename,
            url: att.content
          })),
          testesZephyr,
        };
      } catch (err: any) {
        vscode.window.showErrorMessage(`Erro ao buscar detalhes da issue: ${err.message}`);
        return null;
      }
    })
  );

  // Análise Story, Epic e Func com IA QA (Copilot)
  vscode.commands.registerCommand('plugin-vscode.analiseIaQa', async (description: string, bdd: string) => {
    try {
      const prompt = buildAnaliseStoryEpicFunPrompt({ description, bdd });
      return await askLanguageModel(prompt, {});
    } catch (error: any) {
      vscode.window.showErrorMessage(`Erro ao consultar IA: ${error.message}`);
      return '❌ Erro ao obter resposta da IA.';
    }
  });

  // Análise cenarios com IA QA (Copilot)
  vscode.commands.registerCommand('plugin-vscode.analiseCenariosIaQa', async (userStory: string, cenario: string) => {
    try {
      const prompt = buildAnaliseCenarioPrompt({ userStory, cenarioOriginal: cenario });
      return await askLanguageModel(prompt, {});
    } catch (error: any) {
      vscode.window.showErrorMessage(`Erro ao consultar IA: ${error.message}`);
      return '❌ Erro ao obter resposta da IA.';
    }
  });

  // Criar cenarios com IA QA (Copilot)
  vscode.commands.registerCommand('plugin-vscode.criarCenariosIaQa', async (userStory: string, cenario: string) => {
    try {
      const prompt = buildCriarCenariosPrompt({ userStory });
      return await askLanguageModel(prompt, {});
    } catch (error: any) {
      vscode.window.showErrorMessage(`Erro ao consultar IA: ${error.message}`);
      return '❌ Erro ao obter resposta da IA.';
    }
  });

  // Novo comando: Criar test case no Zephyr
  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.criarTesteZephyr', async (
      texto: string,
      issueId: string,
      issueKey: string,
      automationStatus: string,
      testClass: string,
      testType: string,
      testGroup: string,
      folderId: number) => {
      const { zephyrOwnerId, zephyrToken, zephyrDomain } = getZephyrSettings();
      const url = `https://${zephyrDomain}/v2/testcases`;
      const project = resolveZephyrProjectOrThrow('Criar teste Zephyr', issueKey);
      console.log('&#x1f50d; issueId: ', issueId);
      console.log('&#x1f50d; titulo do teste: ', texto.split('\n')[0].replace(/^Scenario:/i, '').trim());
      console.log('&#x1f50d; projectKey: ', issueKey);
      console.log('&#x1f50d; projectKey resolvido para Zephyr: ', project.zephyrKey);
      console.log('&#x1f50d; automationStatus: ', automationStatus.trim().replace(/\s+/g, ' '));
      console.log('&#x1f50d; testClass: ', testClass.trim().replace(/\s+/g, ' '));
      console.log('&#x1f50d; testType: ', testType.trim().replace(/\s+/g, ' '));
      console.log('&#x1f50d; testGroup: ', testGroup.trim().replace(/\s+/g, ' '));
      // Buscar testes vinculados no Zephyr
      let zephyrData: any = { values: [] };
      let zephyrScriptData: any = { values: [] };
      try {
        const zephyrRes = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${zephyrToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            name: texto.split('\n')[0].replace(/^Scenario:/i, '').trim(),
            projectKey: project.zephyrKey,
            folderId: folderId,
            ownerId: zephyrOwnerId,
            customFields: {
              "Test Type": testType,
              "Test Class": testClass,
              "Automation Status": automationStatus,
              "Test Group": testGroup
            }
          }),
        });
        if (zephyrRes.ok) {
          zephyrData = await zephyrRes.json();
          console.log('&#x1f50d; Dados do zephyr new test case:', JSON.stringify(zephyrData, null, 2));
        } else {
          console.log('&#x1f50d; zephyrRes: ', zephyrRes);
        }
      } catch (zephyrErr: any) {
        console.warn('Erro ao buscar testes no Zephyr:', zephyrErr.message);
      }
      console.log('&#x1f50d; Dados do zephyr:', JSON.stringify(zephyrData, null, 2));
      const semPrimeira = texto.split('\n').slice(1).join('\n');
      console.log('&#x1f50d; Texto:', semPrimeira);
      try {
        const zephyrLink = await fetch(`${url}/${zephyrData.key}/links/issues`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${zephyrToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            "issueId": issueId
          }),
        });
        const zephyrLinkData = zephyrLink.json()
        console.log('&#x1f50d; issueId:', issueId);
        console.log('&#x1f50d; link:', JSON.stringify(zephyrLinkData, null, 2));
      } catch (zephyrErr: any) {
        console.warn('Erro ao buscar testes no Zephyr:', zephyrErr.message);
      }
      try {
        const zephyrRes = await fetch(`${url}/${zephyrData.key}/testscript`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${zephyrToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            "type": "bdd",
            "text": semPrimeira
          }),
        });
        zephyrScriptData = zephyrRes.json()
        return zephyrData.key
      } catch (zephyrErr: any) {
        console.warn('Erro ao buscar testes no Zephyr:', zephyrErr.message);
      }
    })
  );

  // ✅ Novo comando: Criar test case no Zephyr
  vscode.commands.registerCommand('plugin-vscode.atualizarTesteZephyr', async (
    key: string,
    texto: string,
    issueId: string,
    issueKey: string) => {
    const { zephyrOwnerId, zephyrToken, zephyrDomain } = getZephyrSettings();
    const url = `https://${zephyrDomain}/v2/testcases`;
    console.log('&#x1f50d; issueId: ', issueId);
    console.log('&#x1f50d; titulo do teste: ', texto.split('\n')[0].replace(/^Scenario:/i, '').trim());
    console.log('&#x1f50d; projectKey: ', issueKey);
    // Buscar testes vinculados no Zephyr
    let zephyrData: any = { values: [] };
    let zephyrScriptData: any = { values: [] };
    const semPrimeira = texto.split('\n').slice(1).join('\n');
    console.log('&#x1f50d; Texto:', semPrimeira);
    try {
      const zephyrRes = await fetch(`${url}/${key}/testscript`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${zephyrToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          "type": "bdd",
          "text": semPrimeira
        }),
      });
      zephyrScriptData = zephyrRes.json()
      return zephyrData.key
    } catch (zephyrErr: any) {
      console.warn('Erro ao buscar testes no Zephyr:', zephyrErr.message);
    }
  });
  // Comando para obter a lista de pastas
  vscode.commands.registerCommand('plugin-vscode.getZephyrFolders', async (issueKey: string) => {
    const { zephyrOwnerId, zephyrToken, zephyrDomain } = getZephyrSettings();
    let startAt = 0;
    let allFolders: any[] = [];
    let isLast = false;
    const maxResults = 100;
    // const projectKey = issueKey.slice(0, 4);
    // ✅ Resolve via de/para; se faltar, pergunta ao usuário
    const project = await resolveProjectOrPrompt('Listar pastas', issueKey);
    try {
      while (!isLast) {
        // const url = `https://${zephyrDomain}/v2/folders?maxResults=${maxResults}&startAt=${startAt}&projectKey=${projectKey}&folderType=TEST_CASE`;
        const base = `https://${zephyrDomain}/v2/folders`;
        // projectKey ou projectId + outros params
        const url = withProjectParam(base, project) +
                    `&maxResults=${maxResults}&startAt=${startAt}&folderType=TEST_CASE`;
          console.log('&#x1f50d; Zephyr folders URL:', url);
        const zephyrRes = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${zephyrToken}`,
            'Content-Type': 'application/json',
          }
        });
        const zephyrData = await zephyrRes.json();
        const folders = zephyrData.values.map((p: any) => (
          {
            key: p.id,
            parentId: p.parentId,
            name: p.name
          }
        ));
        allFolders = allFolders.concat(folders);
        isLast = zephyrData.isLast;
        startAt += maxResults;
      }
      console.log('&#x1f50d; Dados do zephyr folders:', allFolders);
      return allFolders;
    } catch (err: any) {
      vscode.window.showErrorMessage(`Erro ao buscar pastas no Zephyr: ${err.message}`);
      return [];
    }
  });
}
function getJiraSettings() {
  return {
    jiraDomain: vscode.workspace.getConfiguration().get<string>('plugin.jira.domain') || '',
    jiraEmail: vscode.workspace.getConfiguration().get<string>('plugin.jira.email') || '',
    jiraToken: vscode.workspace.getConfiguration().get<string>('plugin.jira.token') || '',
    jiraProjectCategoryId: vscode.workspace.getConfiguration().get<string>('plugin.jira.projectCategoryId') || '',
  };
}
function getZephyrSettings() {
  return {
    zephyrOwnerId: vscode.workspace.getConfiguration().get<string>('plugin.zephyr.ownerId') || '',
    zephyrDomain: vscode.workspace.getConfiguration().get<string>('plugin.zephyr.domain') || '',
    zephyrToken: vscode.workspace.getConfiguration().get<string>('plugin.zephyr.token') || '',
  };
}
function encodeAuth(email: string, token: string) {
  return Buffer.from(`${email}:${token}`).toString('base64');
}
