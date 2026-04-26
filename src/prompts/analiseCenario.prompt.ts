import { QA_GENERAL_RULES_PTBR, cleanText } from './shared.prompt';

export type AnaliseCenarioInput = {
  userStory: string;
  cenarioOriginal: string;
};

/**
 * Prompt: avaliar e reescrever 1 cenário em Gherkin (keywords EN, texto PT-BR)
 * Origem: função enviarCenarioParaCopilot (extension.ts).
 */
export function buildAnaliseCenarioPrompt(input: AnaliseCenarioInput): string {
  const userStory = cleanText(input.userStory);
  const cenarioOriginal = cleanText(input.cenarioOriginal);

  return `
${QA_GENERAL_RULES_PTBR}

Com base na análise da user story abaixo, avalie também o cenário de teste fornecido e realize as seguintes ações:
1. Classifique o tipo do teste fornecido: **funcional, integração ou end-to-end**.
2. Avalie se o cenário cobre o comportamento esperado da user story.
3. Aponte se há pontos técnicos ou termos inadequados para testes de aceitação.
4. Reescreva o cenário utilizando **boas práticas do Gherkin com as palavras-chave em inglês** (Scenario, Given, And, When, Then)
   mantendo o cenário em português, evitando qualquer linguagem técnica ou de implementação (como Postman, status HTTP, payloads, tabelas do banco, etc).

⚠️ O novo cenário **deve obrigatoriamente estar dentro de um bloco de código com a tag \`\`\`gherkin** no início e \`\`\` no final**, como no exemplo abaixo:
\`\`\`gherkin
Scenario: Exemplo
Given que o usuário acessa a tela de login
When ele insere um e-mail válido
Then ele deve receber um e-mail de redefinição de senha
\`\`\`

5. O novo cenário (apenas 1 cenário) deve estar orientado a **comportamento do usuário** ou do sistema, com clareza, valor de negócio e sem ambiguidade.

---
&#x1f4dd; **User Story Analisada:**
${userStory}

---
&#x1f9ea; **Cenário de Teste Original:**
${cenarioOriginal}
`.trim();
}