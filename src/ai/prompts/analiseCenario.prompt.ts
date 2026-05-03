import { QA_GENERAL_RULES_PTBR, cleanText } from './shared.prompt';

export type AnaliseCenarioInput = {
  userStory: string;
  cenarioOriginal: string;
};

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

FORMATO DE RESPOSTA (OBRIGATÓRIO)
- Responda APENAS com um JSON válido.
- NÃO use Markdown.
- NÃO use texto fora do JSON.
- O campo "cenario_reescrito_gherkin" DEVE conter obrigatoriamente um bloco com \`\`\`gherkin no início e \`\`\` no final (como string).
- Não invente regras que não estejam explícitas na user story; quando faltar informação, use placeholders "[definir ...]".
- Responda somente com o conteúdo raw (texto puro).
- Não use file blocks, não use markdown, não crie anexos/arquivos.

SCHEMA JSON (OBRIGATÓRIO):
{
  "meta": { "versao_schema": "1.0", "idioma": "pt-BR" },
  "classificacao_tipo_teste": "funcional|integração|end-to-end",
  "cobre_user_story": true,
  "avaliacao_cobertura": "...",
  "pontos_tecnicos_ou_termos_inadequados": ["..."],
  "cenario_reescrito_gherkin": "\`\`\`gherkin\\nScenario: ...\\nGiven ...\\nWhen ...\\nThen ...\\n\`\`\`"
}

---
&#x1f4dd; **User Story Analisada:**
${userStory}

---
&#x1f9ea; **Cenário de Teste Original:**
${cenarioOriginal}
`.trim();
}
