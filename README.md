# Quality Plugin

Extensao para Visual Studio Code com integracao ao Jira, Zephyr e apoio a analises de QA com GitHub Copilot.

## Funcionalidades

- Abertura de painel Jira
- Abertura de painel Zephyr
- Integracao com backend
- Configuracoes do plugin
- Analises QA com IA

## Requisitos

- Visual Studio Code compativel com `^1.95.0`
- Node.js e npm instalados

## Empacotamento

Execute os comandos abaixo na raiz do projeto:

```bash
npm install
npm run vscode:prepublish
npx vsce package
```

## Instalacao Manual

No Visual Studio Code:

1. Abra a aba de extensoes.
2. Clique no menu `...`.
3. Selecione `Install from VSIX...`.
4. Escolha o arquivo `.vsix` gerado no empacotamento.

## Configuracoes

O plugin utiliza as seguintes configuracoes:

```text
plugin.jira.domain
plugin.jira.email
plugin.jira.token
plugin.zephyr.domain
plugin.zephyr.token
```
