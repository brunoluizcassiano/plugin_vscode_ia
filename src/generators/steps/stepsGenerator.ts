// src/generators/steps/stepsGenerator.ts
import { fs } from '../utils/utils'; // usa seus helpers já existentes
import * as path from 'path';
import * as vscode from 'vscode';
import jsBeautify from 'js-beautify';
/** Mesmo formato usado no generateFeatures */
export type FeatureInput = {
 key: string;            // TRBC-1234 (ou 'Sem key')
 gherkin: string;        // bloco Gherkin (pode vir cercado por ```gherkin)
 issueId?: string;
 issueKey?: string;
};
export type Options = {
 featureName?: string;
 ruleName?: string;
 fileBaseName?: string;  // base para nome do arquivo
 tribeName?: string;     // ex.: contratos
 extraTags?: string;     // ex.: "@regressivo @rest @autorFulano"
};
/* -----------------------------------------------------------
  Helpers
----------------------------------------------------------- */
/** Remove cercas ```gherkin ...``` e normaliza linhas */
function cleanGherkin(raw: string): string {
 if (!raw) return '';
 const fenced = /```(?:gherkin)?\s*([\s\S]*?)```/i;
 const m = raw.match(fenced);
 const content = m ? m[1] : raw;
 return content
   .split('\n')
   .map(l => l.replace(/^\s+/, ''))       // tira indent à esquerda
   .filter(Boolean)                       // remove linhas vazias puras
   .join('\n');
}
/** Extrai passos (Given/When/Then/And/But + PT) e devolve um set único */
function extractSteps(gherkin: string): string[] {
 const lines = cleanGherkin(gherkin).split('\n');
 // keywords em EN e PT (cucumber entende ambos como passos)
 const stepRe = /^(Given|When|Then|And|But|Dado|Quando|Então|E|Mas)\b/i;
 const unique = new Set<string>();
 let lastType: 'Given' | 'When' | 'Then' | null = null;
 for (const raw of lines) {
   const line = raw.trim();
   if (!line || line.startsWith('#') || line.startsWith('@')) continue;
   if (/^(Feature|Rule|Scenario(?: Outline)?):/i.test(line)) {
     lastType = null;
     continue;
   }
   const m = line.match(stepRe);
   if (!m) continue;
   // normaliza o tipo para Given/When/Then (And/But herdam do anterior)
   let type = m[1];
   if (/^And$/i.test(type) || /^E$/i.test(type) || /^But$/i.test(type) || /^Mas$/i.test(type)) {
     type = (lastType || 'Given') as any;
   } else if (/^Dado$/i.test(type)) {
     type = 'Given';
   } else if (/^Quando$/i.test(type)) {
     type = 'When';
   } else if (/^Então$/i.test(type) || /^Entao$/i.test(type)) {
     type = 'Then';
   } else {
     // mantém Given/When/Then
     type = (type[0].toUpperCase() + type.slice(1).toLowerCase()) as any;
   }
   lastType = type as any;
   // texto do passo sem a keyword
   const text = line.replace(stepRe, '').trim();
   // transforma partes variáveis entre aspas e números em placeholders simples
   // (você pode ajustar para Cucumber Expressions se preferir)
   let expression = text
     // quoted strings -> {string}
     .replace(/"[^"]*"/g, '{string}')
     .replace(/'[^']*'/g, '{string}')
     // números -> {int}
     .replace(/\b\d+\b/g, '{int}');
   // guarda como "<TYPE>|<expression>" para manter info do tipo
   unique.add(`${type}|${expression}`);
 }
 return Array.from(unique);
}
/** Gera código TS para as definições de step a partir da lista única */
function buildStepsCode(allSteps: string[], headerInfo: {
 tribeName?: string;
 issueKey?: string;
 issueId?: string;
 extraTags?: string;
}): string {
 const imports = `import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor';\n`;
 const banner = `/**
* Arquivo gerado automaticamente.
* Ajuste os corpos dos steps conforme necessário.
*
* Metadados:
*   tribe: ${headerInfo.tribeName || '-'}
*   issueKey: ${headerInfo.issueKey || '-'}
*   issueId: ${headerInfo.issueId || '-'}
*   extraTags: ${headerInfo.extraTags || '-'}
*/\n`;
 const blocks = allSteps.map(pair => {
   const [type, expr] = pair.split('|');
   const keyword = (type as 'Given'|'When'|'Then'); // importados acima
   // Usa template string para permitir caracteres especiais no PT
   return `${keyword}(\`${expr}\`, () => {
 // TODO: implemente este passo
});`;
 });
 const code = `${imports}\n${banner}\n${blocks.join('\n\n')}\n`;
 // Embeleza o TS para manter padrão dos outros geradores
 return jsBeautify.js(code, {
   indent_size: 2,
   end_with_newline: true,
 });
}
/* -----------------------------------------------------------
  Função principal
----------------------------------------------------------- */
/**
* Gera um único arquivo de steps (`<base>.steps.ts`) contendo
* skeletons para TODOS os passos encontrados nos cenários.
*
* @param destino Pasta onde salvar
* @param items   Cenários (mesma estrutura do generateFeatures)
* @param options Opções (mesmas do generateFeatures)
* @returns caminho do arquivo gerado (ou string vazia em erro)
*/
export async function generateSteps(
 destino: string,
 items: FeatureInput[],
 options: Options = {}
): Promise<string> {
 try {
   if (!Array.isArray(items) || items.length === 0) {
     vscode.window.showWarningMessage('Nenhum cenário recebido para gerar steps.');
     return '';
   }
   
  // Garante existência do diretório 'AppDriver'
  const stepsDir = `${destino}/steps`;
  if (!fs.existsSync(stepsDir)) {
    fs.mkdirSync(stepsDir, { recursive: true });
  }
   // Base do nome do arquivo: reaproveita a mesma lógica do features
   const base =
     options.fileBaseName ||
     items.find(it => it.issueKey)?.issueKey?.replace(/[^\w\-]/g, '_') ||
     'scenarios';
   const fileName = `${base}Steps.js`;
   const filePath = path.join(stepsDir, fileName);
   // 1) Coleta todos os passos únicos a partir de todos os cenários
   const uniqueSteps: string[] = [];
   const memo = new Set<string>();
   for (const it of items) {
     const steps = extractSteps(it.gherkin || '');
     for (const s of steps) {
       if (!memo.has(s)) {
         memo.add(s);
         uniqueSteps.push(s);
       }
     }
   }
   if (uniqueSteps.length === 0) {
     vscode.window.showWarningMessage('Nenhum passo Gherkin identificado para gerar steps.');
     return '';
   }
   // 2) Monta código final
   const code = buildStepsCode(uniqueSteps, {
     tribeName: options.tribeName,
     issueKey: items[0]?.issueKey,
     issueId: items[0]?.issueId,
     extraTags: options.extraTags,
   });
   // 3) Escreve o arquivo
   fs.writeFileSync(filePath, code, 'utf8');
   vscode.window.showInformationMessage(`Arquivo ${fileName} (steps) gerado com sucesso!`);
   return filePath;
 } catch (err: any) {
   vscode.window.showErrorMessage(`Erro ao gerar steps: ${err?.message || err}`);
   return '';
 }
}
