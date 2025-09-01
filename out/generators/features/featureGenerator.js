"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateFeatures = void 0;
// src/generators/features/featureGenerator.ts
const utils_1 = require("../utils/utils");
const js_beautify_1 = __importDefault(require("js-beautify"));
const vscode = __importStar(require("vscode"));
/** Normaliza uma tag: baixa, sem espaços, sem acentos, caracteres não \w viram '_' */
function normalizeTagBase(s) {
    if (!s)
        return null;
    const lowered = s
        // remove acentos básicos
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^\w]+/g, '-') // tudo que não é [a-zA-Z0-9_] vira -
        .replace(/^-+|-+$/g, ''); // tira - nas pontas
    return lowered ? lowered : null;
}
function toTag(s) {
    const base = normalizeTagBase(s);
    return base ? `@${base}` : null;
}
/** Remove cercas de código e normaliza quebras/indentação básica */
function cleanGherkin(raw) {
    if (!raw)
        return '';
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
function ensureScenarioBlock(gherkin, key) {
    const hasScenario = /(^|\n)\s*Scenario\s*:/i.test(gherkin);
    if (hasScenario)
        return gherkin;
    const title = `Scenario: ${key || 'Cenário'}`;
    return `${title}\n${gherkin}\n`;
}
/** Indenta passos Given/When/Then/And/But com dois espaços */
function indentSteps(block) {
    return (block || '')
        .split('\n')
        .map(l => /^(Given|When|Then|And|But)\b/i.test(l.trim()) ? `  ${l.trim()}` : l.trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
/** Constrói a linha de tags para um cenário específico */
function buildScenarioTags(it, opts) {
    const tags = [];
    const tribeTag = toTag(opts.tribeName); // @contrato, por ex.
    const issueIdTag = (toTag(it.key) || '@semtestcase').toUpperCase();
    const issueKeyTag = (toTag(it.issueKey) || '').toUpperCase();
    if (tribeTag)
        tags.push(tribeTag);
    if (issueIdTag)
        tags.push(issueIdTag);
    if (issueKeyTag)
        tags.push(issueKeyTag);
    // extraTags globais (ex.: "@rest @regressivo")
    if (opts.extraTags) {
        opts.extraTags.split(/\s+/).forEach(t => {
            const tt = toTag(t.replace(/^@/, ''));
            if (tt)
                tags.push(tt);
        });
    }
    // remove duplicadas preservando ordem
    const seen = new Set();
    const unique = tags.filter(t => t && !seen.has(t) && seen.add(t));
    return unique.join(' ');
}
/** Constrói o conteúdo completo do arquivo .feature */
function buildFeatureFile(items, opts) {
    const featureName = opts.featureName || 'Feature gerada pela IA';
    const ruleName = opts.ruleName;
    const header = [];
    //  header.push(`Feature: ${featureName}`);
    //  if (ruleName && ruleName.trim()) header.push(`Rule: ${ruleName.trim()}`);
    //  header.push(''); // linha em branco
    header.push(`Feature: ${featureName}`);
    if (ruleName && ruleName.trim()) {
        header.push(''); // 🔹 linha em branco entre Feature e Rule
        header.push(`Rule: ${ruleName.trim()}`);
    }
    header.push(''); // 🔹 garante uma linha em branco antes dos cenários
    const scenarios = [];
    for (const it of items) {
        const cleaned = cleanGherkin(it.gherkin);
        if (!cleaned)
            continue;
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
    const pretty = js_beautify_1.default.html(`${header.join('\n')}\n${body}`, {
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
function generateFeatures(destino, items, options = {}) {
    var _a, _b, _c;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (!Array.isArray(items) || items.length === 0) {
                vscode.window.showWarningMessage('Nenhum cenário recebido para gerar .feature.');
                return '';
            }
            // Garante existência do diretório 'AppDriver'
            const featureDir = `${destino}/feature`;
            if (!utils_1.fs.existsSync(featureDir)) {
                utils_1.fs.mkdirSync(featureDir, { recursive: true });
            }
            // Base do nome do arquivo: fileBaseName > issueKey do primeiro item > "scenarios"
            const base = options.fileBaseName ||
                ((_b = (_a = items.find(it => it.issueKey)) === null || _a === void 0 ? void 0 : _a.issueKey) === null || _b === void 0 ? void 0 : _b.replace(/[^\w\-]/g, '_')) ||
                'scenarios';
            const fileName = `${base}.feature`;
            const filePath = utils_1.path.join(featureDir, fileName);
            // Monta conteúdo do .feature
            const featureName = options.featureName ||
                `Cenários ${((_c = items[0]) === null || _c === void 0 ? void 0 : _c.issueKey) ? `de ${items[0].issueKey}` : 'gerados'}`;
            const ruleName = options.ruleName; // opcional
            const content = buildFeatureFile(items, {
                featureName,
                ruleName,
                fileBaseName: base,
                tribeName: options.tribeName,
                extraTags: options.extraTags
            });
            // Escreve arquivo
            utils_1.fs.writeFileSync(filePath, content, 'utf8');
            vscode.window.showInformationMessage(`Arquivo ${fileName} gerado com sucesso!`);
            return filePath;
        }
        catch (err) {
            vscode.window.showErrorMessage(`Erro ao gerar arquivo .feature: ${(err === null || err === void 0 ? void 0 : err.message) || err}`);
            return '';
        }
    });
}
exports.generateFeatures = generateFeatures;
