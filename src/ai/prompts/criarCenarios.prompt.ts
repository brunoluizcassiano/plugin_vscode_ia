import { QA_GENERAL_RULES_PTBR, cleanText } from './shared.prompt';

export type CriarCenariosInput = {
  userStory: string;
};

export function buildCriarCenariosPrompt(input: CriarCenariosInput): string {
  const userStory = cleanText(input.userStory);

  return `
${QA_GENERAL_RULES_PTBR}

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

FORMATO DE RESPOSTA (OBRIGATÓRIO)
- Responda APENAS com um JSON válido.
- NÃO use Markdown.
- NÃO use texto fora do JSON.
- Retorne uma lista com a maior quantidade de cenários possível (sem inventar regras que não estejam na user story; quando faltar informação, use placeholders "[definir ...]").
- O campo "gherkin" deve conter obrigatoriamente um bloco com \`\`\`gherkin no início e \`\`\` no final (como string).
- Use exatamente os valores permitidos para Test Type, Test Class e Test Group.
- Responda somente com o conteúdo raw (texto puro).
- Não use file blocks, não use markdown, não crie anexos/arquivos.

SCHEMA JSON (OBRIGATÓRIO):
{
  "meta": { "versao_schema": "1.0", "idioma": "pt-BR" },
  "cenarios": [
    {
      "titulo": "...",
      "test_type": "End to End|Regression|Acceptance|UI",
      "test_class": "Positive|Negative",
      "test_group": "Backend|Front-End|Desktop",
      "cobre_user_story": true,
      "avaliacao_cobertura": "...",
      "pontos_tecnicos_ou_termos_inadequados": ["..."],
      "gherkin": "\`\`\`gherkin\\nScenario: ...\\nGiven ...\\nWhen ...\\nThen ...\\n\`\`\`"
    }
  ]
}

&#x1f4dd; **User Story Analisada:**
${userStory}
`.trim();
}
