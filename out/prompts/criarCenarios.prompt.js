"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCriarCenariosPrompt = void 0;
const shared_prompt_1 = require("./shared.prompt");
/**
 * Prompt: criar vários cenários com classificação (Test Type/Class/Group) e Gherkin.
 * Origem: função enviarCriarCenarioComCopilot (extension.ts).
 */
function buildCriarCenariosPrompt(input) {
    const userStory = (0, shared_prompt_1.cleanText)(input.userStory);
    return `
${shared_prompt_1.QA_GENERAL_RULES_PTBR}

Avalie a user story a seguir priorizando visão de negócio e jornada do cliente, NÃO aspectos técnicos e crie a maior quantidade de testes possíveis e aplique tecnicas de testes avançadas.

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
6. Reescreva o cenário utilizando **boas práticas do Gherkin com as palavras-chave em inglês** (Scenario, Given, And, When, Then)
   mantendo o cenário em portugues, evitando qualquer linguagem técnica ou de implementação (como Postman, status HTTP, payloads, tabelas do banco, etc).

⚠️ O novo cenário **deve obrigatoriamente estar dentro de um bloco de código com a tag \`\`\`gherkin** no início e \`\`\` no final**.

7. O novo cenário deve estar orientado a **comportamento do usuário** ou do sistema, com clareza, valor de negócio e sem ambiguidade.

---
&#x1f4dd; **User Story Analisada:**
${userStory}
`.trim();
}
exports.buildCriarCenariosPrompt = buildCriarCenariosPrompt;
