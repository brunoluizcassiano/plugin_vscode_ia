# Proposta QAgent para o Quality Plugin

## Objetivo

Implementar um QAgent em TypeScript dentro do `qualityPlugin`, focado em testes de aceite e automacao com Cypress para fluxos web e backend/API.

O agente nao deve ser pensado para testes unitarios. O foco principal sera:

- Analise de Story/Epic/Func do Jira.
- Criacao e revisao de cenarios de aceite.
- Geracao de testes Cypress web.
- Geracao de testes Cypress backend/API com `cy.request`.
- Reaproveitamento de padroes ja existentes no projeto.
- Integracao com Zephyr.
- Aprendizado continuo por memoria local.

## Visao Geral

O QAgent sera composto por quatro camadas:

```text
Agente     = orquestrador do fluxo
Skill      = capacidade reutilizavel
Playbook   = receita operacional passo a passo
Memoria    = conhecimento acumulado do projeto, pessoa e time
OpenSpec   = especificacao viva da mudanca antes da geracao de codigo
```

O OpenSpec entra como uma camada opcional de especificacao e rastreabilidade. A proposta e usar o modelo mental do `@fission-ai/openspec` para organizar o trabalho em proposta, requisitos, plano tecnico e tarefas, mas apresentar tudo em tela dentro do plugin. O usuario nao deve precisar ver nem manipular uma pasta `openspec/`. Arquivos OpenSpec podem existir apenas como exportacao opcional ou integracao avancada para times que ja usam a CLI.

## Estrutura Proposta

```text
src/qagent/
  context/
    cypressProjectScanner.ts
    cypressProjectProfiler.ts
    jiraIssueContextBuilder.ts
    zephyrContextBuilder.ts

  memory/
    projectMemoryService.ts
    memoryStore.ts
    lanceMemoryStore.ts
    embeddingService.ts
    generatedTestHistory.ts
    cypressPatternMemory.ts

  openspec/
    openSpecDetector.ts
    openSpecAdapter.ts
    openSpecChangeBuilder.ts
    openSpecTaskBuilder.ts
    openSpecArchiveService.ts

  skills/
    skillRegistry.ts
    skillRunner.ts
    openSpecProposal.skill.ts
    openSpecTasks.skill.ts
    cypressProjectScan.skill.ts
    cypressWebAcceptance.skill.ts
    cypressApiAcceptance.skill.ts
    cypressReview.skill.ts
    jiraStoryAnalysis.skill.ts
    zephyrSync.skill.ts
    memoryRetrieve.skill.ts
    memoryLearn.skill.ts

  playbooks/
    playbookRegistry.ts
    playbookRunner.ts
    proposeQaAutomationFromJira.playbook.ts
    generateCypressFromJira.playbook.ts
    generateApiTestsFromStory.playbook.ts
    reviewExistingCypress.playbook.ts
    zephyrToCypress.playbook.ts

  agents/
    acceptanceStrategyAgent.ts
    cypressWebGenerationAgent.ts
    cypressApiGenerationAgent.ts
    cypressReviewAgent.ts

  prompts/
    acceptanceStrategy.prompt.ts
    cypressWebGeneration.prompt.ts
    cypressApiGeneration.prompt.ts
    cypressReview.prompt.ts

  orchestrator/
    qagentOrchestrator.ts
```

## Cypress Project Scanner

Antes de gerar qualquer teste, o agente precisa descobrir qual projeto Cypress o usuario esta usando.

O scanner deve procurar, em todos os workspace folders do VS Code, sinais como:

- `cypress.config.js`
- `cypress.config.ts`
- `cypress.json`
- `package.json` com dependencia `cypress`
- `cypress/e2e`
- `cypress/integration`
- `cypress/support`
- `cypress/fixtures`

### Criterios de Pontuacao

```text
+50 se existir cypress.config.js/ts
+30 se package.json tiver cypress
+20 se existir cypress/e2e
+15 se existir cypress/support
+10 se existir cypress/fixtures
+10 se package.json tiver script Cypress
```

Se houver uma unica pasta com pontuacao alta, ela pode ser usada automaticamente. Se houver mais de uma, o plugin deve perguntar ao usuario.

### Contrato

```ts
export type CypressProjectCandidate = {
  rootPath: string;
  score: number;
  reasons: string[];
  configFile?: string;
  packageJson?: string;
  e2eFolder?: string;
  supportFolder?: string;
  fixturesFolder?: string;
  language: 'js' | 'ts' | 'mixed' | 'unknown';
};
```

### Perfil do Projeto Cypress

Depois de escolhido o projeto, o agente gera um perfil:

```ts
export type CypressProjectProfile = {
  rootPath: string;
  configFile?: string;
  packageJson?: string;
  e2eFolder?: string;
  integrationFolder?: string;
  supportFolder?: string;
  commandsFile?: string;
  fixturesFolder?: string;
  language: 'js' | 'ts' | 'mixed' | 'unknown';
  scripts: Record<string, string>;
  dependencies: string[];
  customCommands: string[];
  envKeys: string[];
  patterns: {
    usesPageObjects: boolean;
    usesAppActions: boolean;
    usesFixtures: boolean;
    usesIntercepts: boolean;
    usesDataCySelectors: boolean;
    usesApiCommands: boolean;
  };
};
```

## Memoria do QAgent

A memoria permite que o agente aprenda com:

- testes ja criados;
- padroes aceitos pelo usuario;
- estrutura do projeto;
- comandos Cypress existentes;
- feedbacks de revisao;
- decisoes de geracao aceitas ou rejeitadas.

### Local de Armazenamento

A memoria deve ficar no `globalStorage` do VS Code, separada por workspace. Ela tera duas camadas:

1. arquivos JSON/JSONL para historico auditavel, configuracoes e rastreabilidade;
2. `memories.lance` como base semantica local, usando LanceDB, para recuperar conhecimento parecido antes de gerar ou revisar testes.

```text
globalStorage/qagent/projects/{workspaceHash}/
  memory/
    project-profile.json
    cypress-patterns.json
    generated-tests.jsonl
    review-feedback.jsonl

  lancedb/
    memories.lance/
```

O `memories.lance` deve ser tratado como a base de conhecimento principal para busca por similaridade. Antes de criar um teste novo, o QAgent consulta essa base para encontrar exemplos proximos de:

- testes Cypress aceitos anteriormente;
- cenarios Gherkin aprovados;
- comandos customizados do Cypress;
- padroes de autenticacao;
- seletores usados no projeto;
- fixtures, intercepts e massas de dados;
- endpoints ja automatizados;
- decisoes de revisao aceitas ou rejeitadas;
- relacoes entre Jira issue, Zephyr test case e arquivo Cypress.

Os arquivos JSON/JSONL continuam importantes porque sao simples de inspecionar, exportar e versionar. O `memories.lance` entra para responder perguntas como "ja fizemos algo parecido?", "qual comando Cypress o time usa para login?" e "qual padrao de teste backend foi aceito para esse tipo de endpoint?".

Mais tarde, pode haver export/import para versionar uma memoria compartilhada do time. Nesse caso, a exportacao deve incluir tanto os arquivos auditaveis quanto uma forma de reconstruir ou transportar o conteudo do `memories.lance`.

### Exemplo de Registro no memories.lance

```json
{
  "id": "memory_scrum_5_access_platform",
  "kind": "accepted_cypress_test",
  "projectRoot": "qa-academy",
  "issueKey": "SCRUM-5",
  "text": "Teste Cypress aceito para usuario autenticado acessar a plataforma usando cy.login e seletores data-cy.",
  "filePath": "cypress/e2e/auth/access-platform.cy.js",
  "tags": ["cypress", "web", "auth", "accepted", "jira:SCRUM-5"],
  "metadata": {
    "commandsUsed": ["cy.login"],
    "selectorPattern": "data-cy",
    "testType": "web-e2e",
    "acceptedByUser": true
  }
}
```

### Fluxo de Uso da Memoria

```text
1. Scanner identifica o projeto Cypress ativo.
2. QAgent cria ou atualiza o project-profile.json.
3. QAgent indexa testes, comandos, fixtures e exemplos aceitos no memories.lance.
4. Ao receber uma Story/Epic/Func, busca memorias semanticamente parecidas.
5. O prompt de geracao recebe os exemplos recuperados como contexto.
6. Quando o usuario aceita, ajusta ou rejeita o resultado, o feedback volta para JSONL e memories.lance.
```

### Exemplo de Project Profile

```json
{
  "projectRoot": "qa-academy",
  "lastDetectedAt": "2026-04-26T00:00:00Z",
  "commands": ["cy.login", "cy.resetDatabase"],
  "preferredSpecFolder": "cypress/e2e",
  "selectorPattern": "data-cy",
  "acceptedExamples": [
    "cypress/e2e/auth/login.cy.js"
  ]
}
```

### Exemplo de Teste Gerado

```json
{
  "issueKey": "SCRUM-5",
  "type": "web-e2e",
  "scenario": "Usuario autenticado acessa a plataforma",
  "filesCreated": ["cypress/e2e/auth/access-platform.cy.js"],
  "commandsUsed": ["cy.login"],
  "acceptedByUser": true,
  "createdAt": "2026-04-26T00:00:00Z"
}
```

## OpenSpec no QAgent

O OpenSpec deve ser usado para transformar a conversa com a IA em artefatos revisaveis antes da geracao do teste. A ideia e evitar que o QAgent pule direto da Story para um arquivo Cypress sem registrar a intencao, os criterios, os cenarios e as tarefas.

No MVP, o plugin nao deve criar uma pasta `openspec/` no projeto do usuario. O OpenSpec deve ser uma representacao interna persistida no `globalStorage` e exibida em tela por abas, cards e etapas revisaveis.

### Modelo Apresentado em Tela

```text
Tela QAgent / Jira

[Issue]
[Proposta QA]
[Cenarios de Aceite]
[Plano Cypress]
[Tarefas]
[Resultado]
[Rastreabilidade]
```

Cada aba representa uma parte do fluxo OpenSpec, mas com linguagem de QA:

```text
Proposta QA
Explica por que a automacao sera criada e qual comportamento a Story espera.

Cenarios de Aceite
Guarda criterios de aceite, regras de negocio e cenarios em linguagem de QA.

Plano Cypress
Define quais testes Cypress devem existir, quais fluxos cobrir e quais dados usar.

Decisoes Tecnicas
Descreve comandos Cypress, autenticacao, seletores, fixtures, intercepts e cy.request.

Tarefas
Lista tarefas executaveis para o agente criar, revisar, salvar e vincular a automacao.
```

### Persistencia Interna

Os artefatos devem ser salvos internamente no `globalStorage`, junto da memoria do QAgent:

```text
globalStorage/qagent/projects/{workspaceHash}/
  openspec-artifacts/
    {changeId}.json
```

Esse arquivo interno nao precisa aparecer para o usuario. Ele serve para restaurar a tela, continuar fluxos longos, alimentar o `memories.lance` e manter rastreabilidade.

### Exportacao Opcional

Se o time quiser trabalhar com OpenSpec em arquivos, o plugin pode oferecer uma acao manual:

```text
[Exportar para OpenSpec]
```

Somente nesse caso o plugin cria uma estrutura no workspace:

```text
openspec/
  changes/
    scrum-5-acessar-plataforma/
      proposal.md
      design.md
      tasks.md
      specs/
        acceptance.md
        cypress.md
```

Essa exportacao deve ser opcional e nunca o caminho principal da experiencia.

### Fluxo com OpenSpec

```text
Jira Story
-> Proposta QA OpenSpec
-> Cenarios de aceite
-> Plano Cypress
-> Geracao de testes
-> Revisao do usuario
-> memories.lance
-> Zephyr
```

O usuario nao precisa ver o nome OpenSpec em todos os lugares. Na interface, podemos usar nomes mais naturais como `Proposta QA`, `Plano Cypress`, `Memoria do Projeto` e `Rastreabilidade`. Por baixo, o plugin usa um contrato compativel com a ideia do OpenSpec.

### Contrato

```ts
export type QAgentOpenSpecChange = {
  changeId: string;
  issueKey?: string;
  title: string;
  workspaceHash: string;
  source: 'jira' | 'zephyr' | 'manual';
  proposal: string;
  acceptanceScenarios: AcceptanceScenario[];
  cypressPlan: string;
  technicalDecisions: string[];
  tasks: Array<{
    id: string;
    title: string;
    status: 'pending' | 'running' | 'done' | 'blocked';
  }>;
  traceability: {
    jiraIssueKey?: string;
    zephyrTestCaseKey?: string;
    cypressFiles: string[];
  };
  status: 'draft' | 'approved' | 'implemented' | 'archived';
};
```

## Skills

Uma skill representa uma capacidade reutilizavel do agente.

```ts
export type QAgentSkill<I = unknown, O = unknown> = {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  canRun(context: QAgentContext): Promise<boolean>;
  run(input: I, context: QAgentContext): Promise<O>;
};
```

### Skills Iniciais

```text
cypress.project.scan
Detecta o projeto Cypress ativo e seus padroes.

openspec.proposal
Cria ou atualiza a proposta QA da mudanca usando o padrao OpenSpec.

openspec.tasks
Cria plano de tarefas para gerar, revisar e vincular a automacao.

memory.retrieve
Busca exemplos e padroes similares na memoria.

jira.story.analysis
Analisa Story/Epic/Func e transforma em estrategia de aceite.

cypress.web.acceptance
Gera specs web Cypress a partir da story.

cypress.api.acceptance
Gera specs backend/API usando cy.request.

cypress.review
Revisa o teste gerado antes de salvar.

zephyr.scenario.sync
Mapeia cenarios gerados para test cases Zephyr.

memory.learn
Salva aprendizado apos aceite, edicao ou rejeicao do usuario.
```

## Playbooks

Um playbook e uma receita operacional composta por varias skills.

```ts
export type QAgentPlaybook = {
  id: string;
  name: string;
  description: string;
  steps: QAgentPlaybookStep[];
};

export type QAgentPlaybookStep = {
  id: string;
  title: string;
  skillId: string;
  required?: boolean;
  inputFrom?: string[];
  stopOnFailure?: boolean;
};
```

### Playbook: Propor Automacao QA a Partir do Jira

```ts
export const ProposeQaAutomationFromJiraPlaybook: QAgentPlaybook = {
  id: 'propose.qa.automation.from.jira',
  name: 'Propor automacao QA a partir de Jira',
  description: 'Cria proposta QA, cenarios de aceite e plano Cypress antes de gerar codigo.',
  steps: [
    {
      id: 'scan-cypress',
      title: 'Detectar projeto Cypress',
      skillId: 'cypress.project.scan',
      required: true,
      stopOnFailure: true
    },
    {
      id: 'load-memory',
      title: 'Buscar padroes e exemplos similares',
      skillId: 'memory.retrieve',
      required: false
    },
    {
      id: 'analyze-story',
      title: 'Analisar Story e criterios de aceite',
      skillId: 'jira.story.analysis',
      required: true
    },
    {
      id: 'create-openspec-proposal',
      title: 'Criar Proposta QA OpenSpec',
      skillId: 'openspec.proposal',
      required: true
    },
    {
      id: 'create-openspec-tasks',
      title: 'Criar plano de tarefas Cypress',
      skillId: 'openspec.tasks',
      required: true
    }
  ]
};
```

### Playbook: Gerar Cypress a Partir do Jira

```ts
export const GenerateCypressFromJiraPlaybook: QAgentPlaybook = {
  id: 'generate.cypress.from.jira',
  name: 'Gerar Cypress a partir de Jira',
  description: 'Cria testes de aceite Cypress usando issue Jira, contexto do projeto e memoria.',
  steps: [
    {
      id: 'scan-cypress',
      title: 'Detectar projeto Cypress',
      skillId: 'cypress.project.scan',
      required: true,
      stopOnFailure: true
    },
    {
      id: 'load-memory',
      title: 'Buscar padroes e exemplos similares',
      skillId: 'memory.retrieve',
      required: false
    },
    {
      id: 'analyze-story',
      title: 'Analisar Story e criterios de aceite',
      skillId: 'jira.story.analysis',
      required: true
    },
    {
      id: 'generate-web-tests',
      title: 'Gerar testes Cypress Web',
      skillId: 'cypress.web.acceptance',
      required: true
    },
    {
      id: 'review-tests',
      title: 'Revisar testes gerados',
      skillId: 'cypress.review',
      required: true
    },
    {
      id: 'learn',
      title: 'Salvar aprendizado',
      skillId: 'memory.learn',
      required: false
    }
  ]
};
```

## Playbooks Recomendados

### 1. Gerar Cypress Web a partir do Jira

Fluxo:

```text
scan Cypress
criar/atualizar Proposta QA OpenSpec
buscar memoria
analisar story
gerar cenarios
gerar Plano Cypress OpenSpec
gerar spec web
revisar spec
salvar aprendizado
```

### 2. Gerar Cypress API a partir do Jira

Fluxo:

```text
scan Cypress
detectar baseUrl/env
criar/atualizar Proposta QA OpenSpec
buscar comandos API existentes
analisar regras de negocio
gerar Plano Cypress API OpenSpec
gerar cy.request
revisar asserts
salvar aprendizado
```

### 3. Revisar Cypress Existente

Fluxo:

```text
ler spec selecionado
comparar com story/BDD
avaliar asserts
avaliar estabilidade
sugerir melhorias
salvar feedback
```

### 4. Zephyr para Cypress

Fluxo:

```text
ler test cases Zephyr
mapear cenarios
detectar projeto Cypress
gerar specs correspondentes
vincular resultado/memoria
```

## Contrato Principal do Artefato

```ts
export type QAgentArtifact = {
  source: {
    issueKey?: string;
    issueId?: string;
    projectKey?: string;
    summary?: string;
    description?: string;
    bdd?: string;
  };
  context: {
    framework: 'cypress';
    language: 'js' | 'ts';
    hasSupportCommands: boolean;
    detectedPatterns: string[];
    existingSpecs: string[];
  };
  strategy: {
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    testTypes: Array<'acceptance' | 'web-e2e' | 'api' | 'regression'>;
    scenarios: AcceptanceScenario[];
  };
  openSpec?: {
    changeId: string;
    proposalPath: string;
    acceptanceSpecPath: string;
    cypressSpecPath: string;
    designPath: string;
    tasksPath: string;
  };
  generatedFiles: Array<{
    path: string;
    kind: 'web-spec' | 'api-spec' | 'support-command' | 'fixture';
    content: string;
  }>;
  review: {
    status: 'approved' | 'needs-review' | 'blocked';
    notes: string[];
  };
};
```

## UI Proposta

### Tela Jira / Zephyr

Adicionar botao:

```text
QAgent
```

Opcoes:

```text
- Gerar Proposta QA
- Gerar cenarios de aceite
- Gerar Plano Cypress
- Gerar Cypress Web a partir desta issue
- Gerar Cypress API a partir desta issue
- Gerar Web + API
- Revisar teste Cypress existente
- Gerar Cypress a partir dos testes Zephyr
```

A tela pode ser organizada por abas para deixar o fluxo revisavel:

```text
[Issue] [Proposta QA] [Cenarios] [Plano Cypress] [Resultado]
```

O usuario revisa a `Proposta QA` e o `Plano Cypress` antes de permitir que o QAgent crie arquivos no projeto.

### Tela Settings

Adicionar secao:

```text
QAgent
- Projeto Cypress ativo
- Reescanear projeto Cypress
- Alterar projeto Cypress
- Ativar modo OpenSpec
- Criar proposta antes de gerar automacao
- Exibir rastreabilidade QAgent
- Permitir exportar artefatos para OpenSpec
- Memoria ativa
- Limpar memoria do projeto
- Exportar memoria
- Importar memoria
- Playbook padrao
```

### Tela QAgent

Criar uma tela dedicada para acompanhar fluxos longos:

```text
COE Qualidade - QAgent

Projeto Cypress detectado
qa-academy/cypress

Ultima issue analisada
SCRUM-5 - Acessar plataforma QA Academy

Fluxo
[ok] Issue carregada
[ok] Proposta QA criada
[ok] Cenarios revisados
[pendente] Plano Cypress pendente
[pendente] Automacao pendente
[pendente] Zephyr pendente

Acoes
[Continuar fluxo]
[Gerar testes web]
[Gerar testes API]
[Revisar automacao existente]
[Sincronizar Zephyr]
```

### Tela Zephyr

Adicionar rastreabilidade entre Jira, OpenSpec, Cypress e Zephyr:

```text
Caso Zephyr
SCRUM-T123

Origem
Jira: SCRUM-5
Proposta QA: SCRUM-5 / QAgent
Cypress: cypress/e2e/auth/access-platform.cy.js

[Atualizar caso com cenarios]
[Vincular automacao]
```

## Fluxo Completo Exemplo

Usuario pede:

```text
Gerar teste Cypress para SCRUM-5
```

O QAgent executa:

```text
Playbook: generate.cypress.from.jira
```

Passos:

1. `cypress.project.scan`
   - encontra o projeto Cypress ativo;
   - detecta `cypress/e2e`;
   - detecta comandos como `cy.login()`.

2. `memory.retrieve`
   - busca testes parecidos;
   - identifica padroes como `data-cy`;
   - recupera exemplos aceitos.

3. `jira.story.analysis`
   - extrai comportamento esperado;
   - identifica cenarios positivos, negativos e regressivos.

4. `openspec.proposal`
   - preenche a aba `Proposta QA`;
   - preenche a aba `Cenarios de Aceite`;
   - registra a intencao da automacao no artefato interno.

5. `openspec.tasks`
   - preenche a aba `Plano Cypress`;
   - preenche a lista de tarefas;
   - define as decisoes tecnicas da automacao.

6. `cypress.web.acceptance`
   - gera spec Cypress aderente ao projeto.

7. `cypress.review`
   - verifica se nao inventou regras;
   - verifica asserts;
   - verifica aderencia aos padroes do projeto.

8. `memory.learn`
   - salva o resultado e feedback do usuario.

## MVP Recomendado

1. Criar `cypress.project.scan`.
2. Criar `memoryStore`.
3. Criar `memory.retrieve`.
4. Criar `jira.story.analysis`.
5. Criar `openspec.proposal` gerando artefatos internos exibidos em tela.
6. Criar `openspec.tasks` para montar o plano Cypress.
7. Criar `cypress.web.acceptance`.
8. Criar `cypress.review`.
9. Criar playbook `propose.qa.automation.from.jira`.
10. Criar playbook `generate.cypress.from.jira`.
11. Adicionar botao QAgent na tela Jira/Zephyr.
12. Salvar testes aceitos na memoria.

## Evolucao

Depois do MVP:

- Geracao Cypress API.
- Review de specs existentes.
- Integracao opcional com CLI `@fission-ai/openspec`.
- Exportacao opcional para estrutura OpenSpec apos automacao aprovada.
- Tela QAgent dedicada para acompanhar fluxos longos.
- Execucao opcional de `npx cypress run`.
- Sugestao automatica de fixtures.
- Deteccao avancada de selectors.
- Integracao mais forte com Zephyr.
- Memoria compartilhada por time.
- Busca vetorial/embeddings, se JSONL simples deixar de ser suficiente.
