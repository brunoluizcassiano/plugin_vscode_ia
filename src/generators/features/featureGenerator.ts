// src/generators/features/featureGenerator.ts
import { fs, path, capitalize } from '../utils/utils';
import jsBeautify from 'js-beautify';
import * as vscode from 'vscode';
type FeatureInput = {
 /** Ex.: TRBC-1234 (chave do teste ou identificador útil para tag/título) */
 key: string;
 /** Bloco Gherkin vindo da IA (pode vir com ```gherkin ... ``` ou só o texto) */
 gherkin: string;
 issueId?: string;
 issueKey?: string;
};
type Options = {
 /** Nome da Feature no topo do arquivo */
 featureName?: string;
 /** Regra opcional (segunda linha) */
 ruleName?: string;
 /** Nome do arquivo (sem .feature). Se não vier, será deduzido do issueKey ou 'scenarios' */
 fileBaseName?: string;
 /** Nome da tribo (ex.: "contrato") para gerar a tag @contrato em cada cenário */
 tribeName?: string;
 /** Tags adicionais (opcional), separadas por espaço, serão aplicadas a todos os cenários */
 extraTags?: string;
};
/** Normaliza uma tag: baixa, sem espaços, sem acentos, caracteres não \w viram '_' */
function normalizeTagBase(s?: string): string | null {
 if (!s) return null;
 const lowered = s
   // remove acentos básicos
   .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
   .toLowerCase()
   .trim()
   .replace(/[^\w]+/g, '-')  // tudo que não é [a-zA-Z0-9_] vira -
   .replace(/^-+|-+$/g, ''); // tira - nas pontas
 return lowered ? lowered : null;
}
function toTag(s?: string): string | null {
 const base = normalizeTagBase(s);
 return base ? `@${base}` : null;
}
/** Remove cercas de código e normaliza quebras/indentação básica */
function cleanGherkin(raw: string): string {
 if (!raw) return '';
 // remove cercas ```gherkin ... ```
 const fenced = /```(?:gherkin)?\s*([\s\S]*?)```/i;
 const match = raw.match(fenced);
 const content = match ? match[1] : raw;
 // normaliza espaços à esquerda e remove linhas vazias excessivas
 const lines = content
   .split('\n')
   .map(l => l.replace(/^\s+/, ''))
   .filter((l, idx, arr) => !(l.trim() === '' && (idx === 0 || arr[idx - 1].trim() === '')));
 return lines.join('\n').trim() + '\n';
}
/** Garante que o bloco contenha "Scenario:"; se não, prefixa com título básico usando a key */
function ensureScenarioBlock(gherkin: string, key: string): string {
 const hasScenario = /(^|\n)\s*Scenario\s*:/i.test(gherkin);
 if (hasScenario) return gherkin;
 const title = `Scenario: ${key || 'Cenário'}`;
 return `${title}\n${gherkin}\n`;
}
/** Indenta passos Given/When/Then/And/But com dois espaços */
function indentSteps(block: string): string {
 return (block || '')
   .split('\n')
   .map(l => /^(Given|When|Then|And|But)\b/i.test(l.trim()) ? `  ${l.trim()}` : l.trim())
   .join('\n')
   .replace(/\n{3,}/g, '\n\n')
   .trim();
}
/** Constrói a linha de tags para um cenário específico */
function buildScenarioTags(it: FeatureInput, opts: Options): string {
 const tags: string[] = [];
 const tribeTag = toTag(opts.tribeName);           // @contrato, por ex.
 const issueIdTag = (toTag(it.key) || '@semtestcase').toUpperCase();
 const issueKeyTag = (toTag(it.issueKey) || '').toUpperCase();
 if (tribeTag) tags.push(tribeTag);
 if (issueIdTag) tags.push(issueIdTag);
 if (issueKeyTag) tags.push(issueKeyTag);
 // extraTags globais (ex.: "@rest @regressivo")
 if (opts.extraTags) {
   opts.extraTags.split(/\s+/).forEach(t => {
     const tt = toTag(t.replace(/^@/, ''));
     if (tt) tags.push(tt);
   });
 }
 // remove duplicadas preservando ordem
 const seen = new Set<string>();
 const unique = tags.filter(t => t && !seen.has(t) && seen.add(t));
 return unique.join(' ');
}
/** Constrói o conteúdo completo do arquivo .feature */
function buildFeatureFile(items: FeatureInput[], opts: Options): string {
 const featureName = opts.featureName || 'Feature gerada pela IA';
 const ruleName = opts.ruleName;
 const header: string[] = [];
//  header.push(`Feature: ${featureName}`);
//  if (ruleName && ruleName.trim()) header.push(`Rule: ${ruleName.trim()}`);
//  header.push(''); // linha em branco
header.push(`Feature: ${featureName}`);
if (ruleName && ruleName.trim()) {
 header.push(''); // 🔹 linha em branco entre Feature e Rule
 header.push(`Rule: ${ruleName.trim()}`);
}
header.push(''); // 🔹 garante uma linha em branco antes dos cenários
 const scenarios: string[] = [];
 for (const it of items) {
   const cleaned = cleanGherkin(it.gherkin);
   if (!cleaned) continue;
   // garante Scenario e indenta passos
   const withScenario = ensureScenarioBlock(cleaned, it.key);
   const formatted = indentSteps(withScenario);
   // tags exigidas: @tribo @issueId @issueKey (+ extras)
   const tagLine = buildScenarioTags(it, opts);
   const block = tagLine ? `${tagLine}\n${formatted}` : formatted;
   scenarios.push(`${block.trim()}\n`);
 }
 const body = scenarios.join('\n').replace(/\n{3,}/g, '\n\n'); // evita muitos saltos
 // Mantemos js-beautify para ficar alinhado aos outros generators
 const pretty = jsBeautify.html(`${header.join('\n')}\n${body}`, {
   indent_size: 2,
   end_with_newline: true,
 });
 return pretty;
}
/**
* Gera um único arquivo .feature contendo TODOS os cenários passados em `items`.
* - `destino`: caminho de pasta onde salvar o arquivo
* - `items`: array de cenários/gherkin
* - `options`: personalizações (nome da Feature, Rule e base do nome do arquivo, tribeName e extraTags)
*/
export async function generateFeatures(
 destino: string,
 items: FeatureInput[],
 options: Options = {}
): Promise<string> {
 try {
   if (!Array.isArray(items) || items.length === 0) {
     vscode.window.showWarningMessage('Nenhum cenário recebido para gerar .feature.');
     return '';
   }
   // Garante existência do diretório 'AppDriver'
   const featureDir = `${destino}/feature`;
   if (!fs.existsSync(featureDir)) {
    fs.mkdirSync(featureDir, { recursive: true });
   }
   // Base do nome do arquivo: fileBaseName > issueKey do primeiro item > "scenarios"
   const base =
     options.fileBaseName ||
     items.find(it => it.issueKey)?.issueKey?.replace(/[^\w\-]/g, '_') ||
     'scenarios';
   const fileName = `${base}.feature`;
   const filePath = path.join(featureDir, fileName);
   // Monta conteúdo do .feature
   const featureName =
     options.featureName ||
     `Cenários ${items[0]?.issueKey ? `de ${items[0].issueKey}` : 'gerados'}`;
   const ruleName = options.ruleName; // opcional
   const content = buildFeatureFile(items, {
     featureName,
     ruleName,
     fileBaseName: base,
     tribeName: options.tribeName,
     extraTags: options.extraTags
   });
   // Escreve arquivo
   fs.writeFileSync(filePath, content, 'utf8');
   vscode.window.showInformationMessage(`Arquivo ${fileName} gerado com sucesso!`);
   return filePath;
 } catch (err: any) {
   vscode.window.showErrorMessage(`Erro ao gerar arquivo .feature: ${err?.message || err}`);
   return '';
 }
}
