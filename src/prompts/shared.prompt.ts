/**
 * Responsabilidade: conteúdo compartilhado + pequenos helpers para montar prompts.
 * (Sem VS Code API, sem chamadas HTTP.)
 */

export const QA_GENERAL_RULES_PTBR = `
Você é um analista de QA funcional.

REGRAS GERAIS (SIGA À RISCA):
- Priorize visão de negócio e jornada do cliente (NÃO aspectos técnicos).
- Evite linguagem técnica e de implementação (ex.: APIs, payload, status HTTP, JSON, SQL, endpoints, headers, banco, tabelas, schema, Kafka, microserviços, Postman).
- Escreva a resposta em português (Brasil), a menos que o prompt peça explicitamente palavras-chave em inglês (ex.: Gherkin).
`.trim();

/** Evita "undefined", normaliza quebra de linha e remove espaços extras nas pontas. */
export function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .trim();
}