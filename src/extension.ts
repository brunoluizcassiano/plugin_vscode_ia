import fetch from 'node-fetch';
import * as vscode from 'vscode';
import { HomeViewProvider } from './homeViewProvider';
import { JiraPanel } from './panel/jiraPanel';
import { ZephyrPanel } from './panel/zephyrPanel';
import { BackendPanel } from './panel/backendPanel';
import { SettingsPanel } from './panel/settingsPanel';

let globalToken: string | null = null;
let globalThreadId: string | null = null;

export async function activate(context: vscode.ExtensionContext) {
  console.log('✅ Plugin "Form Plugin" está sendo ativado...');
  // Criação da instância da HomeViewProvider
  const homeViewProvider = new HomeViewProvider(context.extensionUri);
  // Registro da webview com o ID que deve coincidir com o package.json
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'homeView', // << TEM QUE BATER COM O ID DO `package.json`
      homeViewProvider
    )
  );
  console.log('✅ HomeViewProvider registrada.');

  // O foco da visualização deve ser feito manualmente ou em resposta a um comando.
  await vscode.commands.executeCommand('workbench.view.extension.formSidebar');
  await vscode.commands.executeCommand('homeView.focus', { preserveFocus: true });

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
    vscode.commands.registerCommand('plugin-vscode.settings', () => {
      SettingsPanel.createOrShow(context.extensionUri);
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
      const { jiraDomain, jiraEmail, jiraToken } = getJiraSettings();
      const auth = encodeAuth(jiraEmail, jiraToken);
      try {
        // const response = await fetch(`https://${jiraDomain}/rest/api/3/project/search?categoryId=10018`, {
        const response = await fetch(`https://${jiraDomain}/rest/api/3/project`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
          },
        });
        const data = await response.json();
        // return data.values.map((p: any) => ({ key: p.key, name: p.name }));
        return data.map((p: any) => ({ key: p.key, name: p.name }));
      } catch (err: any) {
        vscode.window.showErrorMessage(`Erro ao buscar projetos do Jira: ${err?.message || err}`);
        return [];
      }
    })
  );

  // ✅ Método para enviar comentário para a issue:
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

  // 🔍 Comando para buscar sugestões de issues com base no summary
  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.buscarSugestoesIssue', async (texto: string, projectKey?: string) => {
      const { jiraDomain, jiraEmail, jiraToken } = getJiraSettings();
      const auth = encodeAuth(jiraEmail, jiraToken);
      const term = (texto || '').trim();

      // Tipos permitidos
      const allowedTypesJQL = 'issuetype in ("Functionality","Epic","Story")';
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
          return issues.slice(0, 10).map((i: any) => ({
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
  // ✅ Novo comando: buscar detalhes completos da issue
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
        // ✅ Verificar se o tipo da issue é permitido
        const tipo = data.fields.issuetype.name;
        const tiposPermitidos = ['Functionality', 'Funcionalidade', 'Epic', 'Story'];
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
        if (zephyrRes.ok) {
          zephyrData = await zephyrRes.json();
          console.log('🔍 Dados do zephyr:', JSON.stringify(zephyrData, null, 2));
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
      const testcases = Array.isArray(zephyrData) ? zephyrData : [];
      const testesZephyr = await fetchTestScripts(testcases);
      console.log('🔍 Dados do zephyr:', JSON.stringify(testesZephyr, null, 2));
      // Retorno final com todos os dados da issue e scripts
      return {
        key: issueKey,
        testesZephyr,
      };
    })
  );

  // 🔎 Estrutura de pastas do Zephyr por projectKey
  context.subscriptions.push(
    // 🔎 Estrutura de pastas do Zephyr por projectKey (sem resolver ID)
    vscode.commands.registerCommand('plugin-vscode.getZephyrFoldersByProject', async (projectKeyParam: string) => {
      const { zephyrToken, zephyrDomain } = getZephyrSettings();

      try {
        const projectKey = String(projectKeyParam || '').trim();
        if (!projectKey) throw new Error('Project key não informada.');

        let startAt = 0;
        const maxResults = 100;
        let isLast = false;
        const allFolders: Array<{ id: number; parentId: number | null; name: string }> = [];

        while (!isLast) {
          const url = `https://${zephyrDomain}/v2/folders?maxResults=${maxResults}&startAt=${startAt}&projectKey=${encodeURIComponent(projectKey)}&folderType=TEST_CASE`;
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

        return { projectKey, folders: roots, flat: allFolders };
      } catch (err: any) {
        vscode.window.showErrorMessage(`Erro ao carregar pastas do Zephyr: ${err.message}`);
        return { projectKey: '', folders: [], flat: [] };
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

        if (!projectKey || !folderId) {
          vscode.window.showErrorMessage('Projeto e pasta são obrigatórios.');
          return [];
        }

        // 1) Paginação para buscar todos os test cases da PASTA
        let startAt = 0;
        let isLast = false;
        const allTests: any[] = [];

        try {
          while (!isLast) {
            const url = `https://${zephyrDomain}/v2/testcases` +
              `?projectKey=${encodeURIComponent(projectKey)}` +
              `&folderId=${encodeURIComponent(String(folderId))}` +
              `&maxResults=${maxResults}` +
              `&startAt=${startAt}`;

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


  // ✅ Novo comando: buscar detalhes completos da issue
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
        console.log('🔍 Dados da issue:', JSON.stringify(data, null, 2));
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
            console.log('🔍 Dados do zephyr:', JSON.stringify(zephyrData, null, 2));
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

  // 🔍 Análise Story, Epic e Func com IA QA (Copilot)
  vscode.commands.registerCommand('plugin-vscode.analiseIaQa', async (description: string, bdd: string) => {
    const { copilotCookie } = getCopilotSettings();
    try {
      if (!globalToken || !globalThreadId) {
        await criarTokenECriarThread(copilotCookie);
      }
      try {
        return await analiseStoryEpicFunCopilot(globalToken!, globalThreadId!, description, bdd);
      } catch (err) {
        // Se falhou, tentar renovar token+thread uma única vez
        console.log('⚠️ Token expirado, tentando renovar...');
        await criarTokenECriarThread(copilotCookie);
        return await analiseStoryEpicFunCopilot(globalToken!, globalThreadId!, description, bdd);
      }
    } catch (error: any) {
      vscode.window.showErrorMessage(`Erro ao consultar IA Copilot: ${error.message}`);
      return '❌ Erro ao obter resposta da IA.';
    }
  });

  // 🔍 Análise cenarios com IA QA (Copilot)
  vscode.commands.registerCommand('plugin-vscode.analiseCenariosIaQa', async (userStory: string, cenario: string) => {
    const { copilotCookie } = getCopilotSettings();
    try {
      if (!globalToken || !globalThreadId) {
        await criarTokenECriarThread(copilotCookie);
      }
      try {
        return await enviarCenarioParaCopilot(globalToken!, globalThreadId!, userStory, cenario);
      } catch (err) {
        // Se falhou, tentar renovar token+thread uma única vez
        console.log('⚠️ Token expirado, tentando renovar...');
        await criarTokenECriarThread(copilotCookie);
        return await enviarCenarioParaCopilot(globalToken!, globalThreadId!, userStory, cenario);
      }
    } catch (error: any) {
      vscode.window.showErrorMessage(`Erro ao consultar IA Copilot: ${error.message}`);
      return '❌ Erro ao obter resposta da IA.';
    }
  });

  // 🔍 Criar cenarios com IA QA (Copilot)
  vscode.commands.registerCommand('plugin-vscode.criarCenariosIaQa', async (userStory: string, cenario: string) => {
    const { copilotCookie } = getCopilotSettings();
    try {
      if (!globalToken || !globalThreadId) {
        await criarTokenECriarThread(copilotCookie);
      }
      try {
        return await enviarCriarCenarioComCopilot(globalToken!, globalThreadId!, userStory, cenario);
      } catch (err) {
        // Se falhou, tentar renovar token+thread uma única vez
        console.log('⚠️ Token expirado, tentando renovar...');
        await criarTokenECriarThread(copilotCookie);
        return await enviarCriarCenarioComCopilot(globalToken!, globalThreadId!, userStory, cenario);
      }
    } catch (error: any) {
      vscode.window.showErrorMessage(`Erro ao consultar IA Copilot: ${error.message}`);
      return '❌ Erro ao obter resposta da IA.';
    }
  });

  // ✅ Novo comando: Criar test case no Zephyr
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
      console.log('🔍 issueId: ', issueId);
      console.log('🔍 titulo do teste: ', texto.split('\n')[0].replace(/^Scenario:/i, '').trim());
      console.log('🔍 projectKey: ', issueKey);
      console.log('🔍 automationStatus: ', automationStatus.trim().replace(/\s+/g, ' '));
      console.log('🔍 testClass: ', testClass.trim().replace(/\s+/g, ' '));
      console.log('🔍 testType: ', testType.trim().replace(/\s+/g, ' '));
      console.log('🔍 testGroup: ', testGroup.trim().replace(/\s+/g, ' '));
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
            projectKey: issueKey.slice(0, 4),
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
          console.log('🔍 Dados do zephyr new test case:', JSON.stringify(zephyrData, null, 2));
        } else {
          console.log('🔍 zephyrRes: ', zephyrRes);
        }
      } catch (zephyrErr: any) {
        console.warn('Erro ao buscar testes no Zephyr:', zephyrErr.message);
      }
      console.log('🔍 Dados do zephyr:', JSON.stringify(zephyrData, null, 2));
      const semPrimeira = texto.split('\n').slice(1).join('\n');
      console.log('🔍 Texto:', semPrimeira);
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
        console.log('🔍 issueId:', issueId);
        console.log('🔍 link:', JSON.stringify(zephyrLinkData, null, 2));
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
    console.log('🔍 issueId: ', issueId);
    console.log('🔍 titulo do teste: ', texto.split('\n')[0].replace(/^Scenario:/i, '').trim());
    console.log('🔍 projectKey: ', issueKey);

    // Buscar testes vinculados no Zephyr
    let zephyrData: any = { values: [] };
    let zephyrScriptData: any = { values: [] };
    const semPrimeira = texto.split('\n').slice(1).join('\n');
    console.log('🔍 Texto:', semPrimeira);
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
    const projectKey = issueKey.slice(0, 4);
    try {
      while (!isLast) {
        const url = `https://${zephyrDomain}/v2/folders?maxResults=${maxResults}&startAt=${startAt}&projectKey=${projectKey}&folderType=TEST_CASE`;
        const zephyrRes = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${zephyrToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
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
      console.log('🔍 Dados do zephyr folders:', allFolders);
      return allFolders;
    } catch (err: any) {
      vscode.window.showErrorMessage(`Erro ao buscar pastas no Zephyr: ${err.message}`);
      return [];
    }
  });
}

async function criarTokenECriarThread(cookie: string): Promise<{ token: string; threadId: string }> {
  // Criar token
  const tokenRes = await fetch(`https://github.com/github-copilot/chat/token`, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'accept-encoding': 'application/json',
      'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Connection': 'keep-alive',
      'Content-Length': '0',
      'Content-Type': 'application/json',
      'Cookie': `${cookie}`,
      'GitHub-Verified-Fetch': 'true',
      'Host': 'github.com',
      'Origin': 'https://github.com'
    },
    body: JSON.stringify({})
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.token;
  console.log('🔍 Copilot token:', JSON.stringify(token, null, 2));
  // Criar thread
  const threadRes = await fetch(`https://api.business.githubcopilot.com/github/chat/threads`, {
    method: 'POST',
    headers: {
      'authorization': `GitHub-Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({})
  });
  const threadData = await threadRes.json();
  const threadId = threadData.thread_id;
  console.log('🔍 Copilot threadId:', JSON.stringify(threadId, null, 2));
  // Armazenar globalmente
  globalToken = token;
  globalThreadId = threadId;
  return { token, threadId };
}

async function enviarCriarCenarioComCopilot(token: string, threadId: string, userStory: string, cenarioOriginal: string): Promise<string> {
  console.log('🔍 Copilot user Story recebida:', userStory);
  console.log('🔍 Copilot cenario Original:', cenarioOriginal);
  const payload = {
    responseMessageID: crypto.randomUUID(),
    content: `Você é um analista de QA funcional. Avalie a user story a seguir priorizando visão de negócio e jornada do cliente, NÃO aspectos técnicos e crie a maior quantidade de testes possiveis e aplique tecnicas de testes avançadas.
              Com base na análise da user story abaixo, crie cenários de testes e realize as seguintes ações:
                    1. Classifique o tipo do teste criado (**Test Type**): escolha entre *End to End*, *Regression*, *Acceptance* ou *UI*.  
                    2. Classifique o cenário como **Test Class**: *Positive* ou *Negative*.  
                    3. Classifique o cenário como **Test Group**: *Backend*, *Front-End* ou *Desktop*.
                       ⚠️ Importante: os campos acima devem ser retornados exatamente como exemplo:
                      **Test Type:** Acceptance  
                      **Test Class:** Positive  
                      **Test Group:** Front-End  
                    4. Avalie se o cenário cobre o comportamento esperado da user story.  
                    5. Aponte se há pontos técnicos ou termos inadequados para testes de aceitação.  
                    6. Reescreva o cenário utilizando **boas práticas do Gherkin com as palavras-chave em inglês** (Scenario, Given, And, When, Then)mantendo o cenário em portugues**, evitando qualquer linguagem técnica ou de implementação (como Postman, status HTTP, payloads, tabelas do banco, etc). 
                      ⚠️ O novo cenário **deve obrigatoriamente estar dentro de um bloco de código com a tag \`\`\`gherkin** no início e \`\`\` no final**, como no exemplo abaixo:
                      \`\`\`gherkin
                      Scenario: Exemplo
                      Given que o usuário acessa a tela de login
                      When ele insere um e-mail válido
                      Then ele deve receber um e-mail de redefinição de senha
                      \`\`\`  
                    7. O novo cenário deve estar orientado a **comportamento do usuário** ou do sistema, com clareza, valor de negócio e sem ambiguidade.
                    ---
                    📝 **User Story Analisada:** ${userStory}`,
    intent: 'conversation',
    references: [],
    context: [],
    currentURL: 'https://github.com/copilot/c/f7d5070e-bbdc-4a40-a844-f8625f316c1a',
    streaming: false,
    confirmations: [],
    customInstructions: [],
    model: 'gpt-4.1',
    mode: 'immersive',
    parentMessageID: crypto.randomUUID(),
    tools: [],
    mediaContent: [],
    skillOptions: { deepCodeSearch: false }
  };
  const sendMsgRes = await fetch(`https://api.business.githubcopilot.com/github/chat/threads/${threadId}/messages`, {
    method: 'POST',
    headers: {
      'authorization': `GitHub-Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  });
  if (!sendMsgRes.ok) {
    throw new Error(`Erro ao enviar cenário: ${sendMsgRes.status}`);
  }
  await new Promise(r => setTimeout(r, 1000));
  const messagesRes = await fetch(`https://api.business.githubcopilot.com/github/chat/threads/${threadId}/messages`, {
    method: 'GET',
    headers: {
      'authorization': `GitHub-Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const messagesData = await messagesRes.json();
  const ultimaResposta = messagesData?.messages?.[messagesData.messages.length - 1]?.content || '⚠️ Nenhuma resposta recebida.';
  const messagesLength = messagesData?.messages?.[messagesData.messages.length - 1]?.content
  console.log('🔍 Copilot messagesData:', messagesLength);
  return ultimaResposta;
}

async function enviarCenarioParaCopilot(token: string, threadId: string, userStory: string, cenarioOriginal: string): Promise<string> {
  console.log('🔍 Copilot user Story recebida:', userStory);
  console.log('🔍 Copilot cenario Original:', cenarioOriginal);
  const payload = {
    responseMessageID: crypto.randomUUID(),
    content: `Você é um analista de QA funcional. Avalie a user story a seguir priorizando visão de negócio e jornada do cliente, NÃO aspectos técnicos e crie a maior quantidade de testes possiveis e aplique tecnicas de testes avançadas.
              Com base na análise da user story abaixo, avalie também o cenário de teste fornecido e realize as seguintes ações:
                    1. Classifique o tipo do teste fornecido: **funcional, integração ou end-to-end**.  
                    2. Avalie se o cenário cobre o comportamento esperado da user story.  
                    3. Aponte se há pontos técnicos ou termos inadequados para testes de aceitação.  
                    4. Reescreva o cenário utilizando **boas práticas do Gherkin com as palavras-chave em inglês** (Scenario, Given, And, When, Then)mantendo o cenário em portugues**, evitando qualquer linguagem técnica ou de implementação (como Postman, status HTTP, payloads, tabelas do banco, etc). 
                      ⚠️ O novo cenário **deve obrigatoriamente estar dentro de um bloco de código com a tag \`\`\`gherkin** no início e \`\`\` no final**, como no exemplo abaixo:
                      \`\`\`gherkin
                      Scenario: Exemplo
                      Given que o usuário acessa a tela de login
                      When ele insere um e-mail válido
                      Then ele deve receber um e-mail de redefinição de senha
                      \`\`\`  
                    5. O novo cenário (apenas 1 cenário) deve estar orientado a **comportamento do usuário** ou do sistema, com clareza, valor de negócio e sem ambiguidade.
                    ---
                    📝 **User Story Analisada:** ${userStory}
                    ---
                    🧪 **Cenário de Teste Original:** ${cenarioOriginal}`,
    intent: 'conversation',
    references: [],
    context: [],
    currentURL: 'https://github.com/copilot/c/f7d5070e-bbdc-4a40-a844-f8625f316c1a',
    streaming: false,
    confirmations: [],
    customInstructions: [],
    model: 'gpt-4.1',
    mode: 'immersive',
    parentMessageID: crypto.randomUUID(),
    tools: [],
    mediaContent: [],
    skillOptions: { deepCodeSearch: false }
  };
  const sendMsgRes = await fetch(`https://api.business.githubcopilot.com/github/chat/threads/${threadId}/messages`, {
    method: 'POST',
    headers: {
      'authorization': `GitHub-Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  });
  if (!sendMsgRes.ok) {
    throw new Error(`Erro ao enviar cenário: ${sendMsgRes.status}`);
  }
  await new Promise(r => setTimeout(r, 1000));
  const messagesRes = await fetch(`https://api.business.githubcopilot.com/github/chat/threads/${threadId}/messages`, {
    method: 'GET',
    headers: {
      'authorization': `GitHub-Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const messagesData = await messagesRes.json();
  const ultimaResposta = messagesData?.messages?.[messagesData.messages.length - 1]?.content || '⚠️ Nenhuma resposta recebida.';
  const messagesLength = messagesData?.messages?.[messagesData.messages.length - 1]?.content
  console.log('🔍 Copilot messagesData:', messagesLength);
  return ultimaResposta;
}

async function analiseStoryEpicFunCopilot(token: string, threadId: string, description: string, bdd: string): Promise<string> {
  const payload = {
    responseMessageID: crypto.randomUUID(),
    content: `Você é um analista de QA funcional. Avalie a user story a seguir priorizando visão de negócio e jornada do cliente, NÃO aspectos técnicos.

              INSTRUÇÕES IMPORTANTES (SIGA À RISCA):
              - Se a descrição for predominantemente técnica (ex.: APIs, payload, status HTTP, banco, headers, microserviços, JSON, SQL, Postman) e não houver **regras de negócio** e **pré-condições** claras, você DEVE:
                • Atribuir notas BAIXAS (máx. 2/5) para: "Clareza de requisitos funcionais", "Visão centrada no cliente", "Viabilidade de extração de cenários" e INVEST (V - Valiosa e T - Testável).  
                • Classificar como "Precisa de refinamento" no parecer, explicitando as lacunas.
              - Critérios de aceite DEVEM ser **funcionais**, em linguagem de negócio e **orientados à jornada/experiência do usuário**.  
                • PROIBIDO mencionar termos técnicos (HTTP, 200/400/500, payload, JSON, API, endpoint, banco, tabela, schema, Kafka etc.).  
                • Foque em estados do sistema perceptíveis pelo usuário, regras de elegibilidade, mensagens e comportamentos.
              - Se houver BDD, avalie a coerência com o negócio; se estiver técnico, proponha versão funcional.
              - Escreva toda a resposta em **português (Brasil)**.
              
              Analise a seguinte user story extraída do Jira e classifique-a de acordo com os seguintes critérios:
              1. Clareza e detalhamento dos requisitos funcionais
              2. Presença de objetivos e visão centrada no cliente
              3. Viabilidade de extração de cenários de testes funcionais e E2E com base na descrição fornecida
              Ao realizar a análise, considere também os princípios do padrão INVEST (Independente, Negociável, Valiosa, Estimável, Pequena e Testável) e a aderência, quando aplicável, à estrutura do framework BDD (Behavior-Driven Development), com foco em comportamento esperado do sistema.
              Para cada critério, atribua uma nota de 1 a 5 e explique brevemente o motivo da nota.
              Em seguida, indique se essa user story está pronta para desenvolvimento e testes ou se precisa de refinamento.
              Finalize com uma classificação geral da story como:
              ótima, boa, regular ou ruim (sem explicações nesta parte).
              Por fim, com base em sua análise, forneça **uma sugestão de melhoria para a escrita da user story**. A nova versão deve ser clara, objetiva, orientada a valor de negócio, e — quando possível — escrita no formato BDD ou estruturada com clareza para testes.
              Aqui está a user story a ser analisada:
              \n\nDescrição:\n${description}\n\nBDD:\n${bdd}`,
    intent: 'conversation',
    references: [],
    context: [],
    currentURL: 'https://github.com/copilot/c/f7d5070e-bbdc-4a40-a844-f8625f316c1a',
    streaming: false,
    confirmations: [],
    customInstructions: [],
    model: 'gpt-4.1',
    mode: 'immersive',
    parentMessageID: crypto.randomUUID(),
    tools: [],
    mediaContent: [],
    skillOptions: { deepCodeSearch: false }
  };
  const sendMsgRes = await fetch(`https://api.business.githubcopilot.com/github/chat/threads/${threadId}/messages`, {
    method: 'POST',
    headers: {
      'authorization': `GitHub-Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  });
  if (!sendMsgRes.ok) {
    throw new Error(`Erro ao enviar cenário: ${sendMsgRes.status}`);
  }
  await new Promise(r => setTimeout(r, 1000));
  const messagesRes = await fetch(`https://api.business.githubcopilot.com/github/chat/threads/${threadId}/messages`, {
    method: 'GET',
    headers: {
      'authorization': `GitHub-Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const messagesData = await messagesRes.json();
  const ultimaResposta = messagesData?.messages?.[messagesData.messages.length - 1]?.content || '⚠️ Nenhuma resposta recebida.';
  const messagesLength = messagesData?.messages?.[messagesData.messages.length - 1]?.content
  console.log('🔍 Copilot messagesData:', messagesLength);
  return ultimaResposta;
}

function getJiraSettings() {
  return {
    jiraDomain: vscode.workspace.getConfiguration().get<string>('plugin.jira.domain') || '',
    jiraEmail: vscode.workspace.getConfiguration().get<string>('plugin.jira.email') || '',
    jiraToken: vscode.workspace.getConfiguration().get<string>('plugin.jira.token') || '',
  };
}

function getZephyrSettings() {
  return {
    zephyrOwnerId: vscode.workspace.getConfiguration().get<string>('plugin.zephyr.ownerId') || '',
    zephyrDomain: vscode.workspace.getConfiguration().get<string>('plugin.zephyr.domain') || '',
    zephyrToken: vscode.workspace.getConfiguration().get<string>('plugin.zephyr.token') || '',
  };
}

function getCopilotSettings() {
  return {
    copilotCookie: vscode.workspace.getConfiguration().get<string>('plugin.copilot.Cookie') || '',
  };
}

function encodeAuth(email: string, token: string) {
  return Buffer.from(`${email}:${token}`).toString('base64');
}