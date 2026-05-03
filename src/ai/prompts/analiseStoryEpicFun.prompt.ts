import { QA_GENERAL_RULES_PTBR, cleanText } from './shared.prompt';

export type AnaliseStoryEpicFunInput = {
  description: string;
  bdd: string;
};

export function buildAnaliseStoryEpicFunPrompt(input: AnaliseStoryEpicFunInput): string {
  const description = cleanText(input.description);
  const bdd = cleanText(input.bdd);

  return `
${QA_GENERAL_RULES_PTBR}

Você é um(a) especialista em análise de requisitos e QA. Avalie a Story/Epic/Func do Jira e responda em JSON.

REGRAS CRÍTICAS
1) Se a descrição/BDD for predominantemente técnica (ex.: APIs, payload, status HTTP, banco, headers, microserviços, JSON, SQL, Postman)
   e NÃO houver regras de negócio e pré-condições claras, você DEVE:
   - Dar notas BAIXAS (máx. 2/5) para:
     • Clareza de requisitos funcionais
     • Visão centrada no cliente
     • Viabilidade de extração de cenários
     • INVEST: V (Valiosa) e T (Testável)
   - Definir o status como "Precisa de refinamento"
   - Explicitar as lacunas objetivamente

2) Proibição de termos técnicos SOMENTE dentro de:
   - sugestao_melhoria.nova_descricao
   - sugestao_melhoria.criterios_aceite_gherkin
   - sugestao_melhoria.premissas
   - sugestao_melhoria.beneficio_esperado
   - sugestao_melhoria.fatiamento[*].titulo
   - sugestao_melhoria.fatiamento[*].story
   - sugestao_melhoria.fatiamento[*].valor
   - sugestao_melhoria.fatiamento[*].escopo_in
   - sugestao_melhoria.fatiamento[*].escopo_out
   - sugestao_melhoria.fatiamento[*].criterios_aceite_gherkin
   - sugestao_melhoria.fatiamento[*].premissas
   Nessas partes, é PROIBIDO mencionar: HTTP, status code, payload, JSON, API, endpoint, banco, tabela, schema, Kafka, headers, microserviços etc.

3) Para evitar respostas longas e reduzir alucinação, seja conciso e específico:
   - Em cada "motivo" das notas (notas.* e invest.*), escreva no máximo 2 frases objetivas.
   - Em bdd.motivo, escreva no máximo 2 frases.
   - Em bdd.riscos_ambiguidades, retorne de 2 a 5 itens (se aplicável).
   - Em parecer.lacunas_principais, retorne de 3 a 7 itens.
   - Em parecer.perguntas_refinamento, retorne de 3 a 7 perguntas.
   - Em sugestao_melhoria.premissas, retorne de 2 a 6 itens.
   - Em sugestao_melhoria.fatiamento, retorne de 2 a 5 itens quando aplicável.

4) Regras para critérios de aceite em Gherkin (BDD):
   - sugestao_melhoria.criterios_aceite_gherkin DEVE ser uma lista de cenários em Gherkin.
   - Cada item da lista DEVE conter exatamente 1 cenário, usando SOMENTE: "Cenário:", "Dado", "Quando", "Então".
   - NÃO use "E", "Mas", "Contexto", "Esquema do Cenário", "Exemplos".
   - Os 3 passos (Dado/Quando/Então) devem ser suficientes e completos.
   - Use linguagem de negócio e comportamentos observáveis (o que muda para usuário/cliente/negócio).

5) Não alucinar:
   - Não invente regras, mensagens ao cliente, notificações, canais, integrações ou efeitos financeiros que não estejam explícitos na Descrição/BDD.
   - Se algo for necessário para fechar o requisito, registre como lacuna/pergunta com placeholder.
   - Para o fatiamento, não invente regras novas: use placeholders "[definir ...]" quando a regra necessária não estiver explícita.

6) Regra de "riqueza" nos motivos das NOTAS (sem aumentar o tamanho):
   - Para as 3 chaves em "notas" (clareza_requisitos_funcionais, visao_centrada_no_cliente, viabilidade_cenarios_funcional_e2e),
     o campo "motivo" DEVE seguir este formato em 2 frases:
       Frase 1: O que está faltando/ambíguo (cite 1 a 2 lacunas objetivas).
       Frase 2: Impacto prático (como isso afeta entendimento, refinamento, estimativa ou teste) OU um exemplo do tipo de informação que deveria existir (sem inventar detalhes).
   - Evite frases genéricas repetidas ("está técnico", "pouco claro") sem dizer exatamente o que falta.

7) Regra de fatiamento (aprimoramento da sugestão de melhoria):
   - Você DEVE escolher uma estratégia em sugestao_melhoria.estrategia: "manter_unica" ou "fatiar".
   - Use "fatiar" quando a story aparentar grande escopo, múltiplos objetivos, baixa testabilidade em uma única entrega, ou quando INVEST.S <= 2.
   - Use "manter_unica" quando o escopo e objetivo forem únicos e claros.
   - Quando "manter_unica":
     • Preencha nova_descricao, premissas, beneficio_esperado e criterios_aceite_gherkin normalmente.
     • sugestao_melhoria.fatiamento DEVE ser uma lista vazia [].
   - Quando "fatiar":
     • nova_descricao deve ser uma descrição curta e genérica da iniciativa (1 a 3 frases), sem entrar em detalhes de execução.
     • fatiamento DEVE conter de 2 a 5 mini-stories.
     • Cada mini-story DEVE ser independente o suficiente para gerar critérios de aceite e 1 cenário (Gherkin) por item.
     • A ordem_sugerida deve iniciar em 1 e refletir entrega por valor e redução de risco:
       1 = menor recorte com valor (fluxo mais comum / happy path)
       depois = variações, exceções essenciais e melhorias incrementais
     • Evite criar fatias "por camada" (ex.: separar por telas/serviços). Fatie por valor de negócio, regras e comportamento observável.

FORMATO DE RESPOSTA (OBRIGATÓRIO)
- Responda APENAS com um JSON válido.
- NÃO use Markdown.
- NÃO use texto fora do JSON.
- Use exatamente as chaves do schema abaixo.
- Notas são de 1 a 5 (inteiros).
- Se faltarem informações, use placeholders claros tipo: "[definir ...]" e mantenha o parecer como "Precisa de refinamento".
- Responda somente com o conteúdo raw (texto puro).
- Não use file blocks, não use markdown, não crie anexos/arquivos.
SCHEMA JSON:
{
  "meta": { "versao_schema": "1.2", "idioma": "pt-BR" },
  "notas": {
    "clareza_requisitos_funcionais": { "nota": 1, "motivo": "..." },
    "visao_centrada_no_cliente": { "nota": 1, "motivo": "..." },
    "viabilidade_cenarios_funcional_e2e": { "nota": 1, "motivo": "..." }
  },
  "invest": {
    "I": { "nota": 1, "motivo": "..." },
    "N": { "nota": 1, "motivo": "..." },
    "V": { "nota": 1, "motivo": "..." },
    "E": { "nota": 1, "motivo": "..." },
    "S": { "nota": 1, "motivo": "..." },
    "T": { "nota": 1, "motivo": "..." }
  },
  "bdd": {
    "avaliacao": "coerente|incompleto|tecnico|ausente",
    "motivo": "...",
    "riscos_ambiguidades": ["..."]
  },
  "parecer": {
    "status": "Pronta para desenvolvimento e testes|Precisa de refinamento",
    "lacunas_principais": ["..."],
    "perguntas_refinamento": ["..."]
  },
  "classificacao_geral": "ótima|boa|regular|ruim",
  "sugestao_melhoria": {
    "estrategia": "manter_unica|fatiar",
    "motivo_estrategia": "...",
    "nova_descricao": "...",
    "premissas": ["..."],
    "beneficio_esperado": "...",
    "criterios_aceite_gherkin": [
      "Cenário: ...\nDado ...\nQuando ...\nEntão ..."
    ],
    "fatiamento": [
      {
        "ordem_sugerida": 1,
        "titulo": "...",
        "story": "...",
        "valor": "...",
        "escopo_in": ["..."],
        "escopo_out": ["..."],
        "premissas": ["..."],
        "criterios_aceite_gherkin": [
          "Cenário: ...\nDado ...\nQuando ...\nEntão ..."
        ]
      }
    ]
  }
}

INPUT

Descrição:
${description}

BDD:
${bdd}
`.trim();
}
