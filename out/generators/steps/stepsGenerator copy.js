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
exports.generateSteps = void 0;
// src/generators/steps/stepsGenerator.ts
const utils_1 = require("../utils/utils"); // usa seus helpers já existentes
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const js_beautify_1 = __importDefault(require("js-beautify"));
/* -----------------------------------------------------------
  Helpers
----------------------------------------------------------- */
/** Remove cercas ```gherkin ...``` e normaliza linhas */
function cleanGherkin(raw) {
    if (!raw)
        return '';
    const fenced = /```(?:gherkin)?\s*([\s\S]*?)```/i;
    const m = raw.match(fenced);
    const content = m ? m[1] : raw;
    return content
        .split('\n')
        .map(l => l.replace(/^\s+/, '')) // tira indent à esquerda
        .filter(Boolean) // remove linhas vazias puras
        .join('\n');
}
/** Extrai passos (Given/When/Then/And/But + PT) e devolve um set único */
function extractSteps(gherkin) {
    const lines = cleanGherkin(gherkin).split('\n');
    // keywords em EN e PT (cucumber entende ambos como passos)
    const stepRe = /^(Given|When|Then|And|But|Dado|Quando|Então|E|Mas)\b/i;
    const unique = new Set();
    let lastType = null;
    for (const raw of lines) {
        const line = raw.trim();
        if (!line || line.startsWith('#') || line.startsWith('@'))
            continue;
        if (/^(Feature|Rule|Scenario(?: Outline)?):/i.test(line)) {
            lastType = null;
            continue;
        }
        const m = line.match(stepRe);
        if (!m)
            continue;
        // normaliza o tipo para Given/When/Then (And/But herdam do anterior)
        let type = m[1];
        if (/^And$/i.test(type) || /^E$/i.test(type) || /^But$/i.test(type) || /^Mas$/i.test(type)) {
            type = (lastType || 'Given');
        }
        else if (/^Dado$/i.test(type)) {
            type = 'Given';
        }
        else if (/^Quando$/i.test(type)) {
            type = 'When';
        }
        else if (/^Então$/i.test(type) || /^Entao$/i.test(type)) {
            type = 'Then';
        }
        else {
            // mantém Given/When/Then
            type = (type[0].toUpperCase() + type.slice(1).toLowerCase());
        }
        lastType = type;
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
function buildStepsCode(allSteps, headerInfo) {
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
        const keyword = type; // importados acima
        // Usa template string para permitir caracteres especiais no PT
        return `${keyword}(\`${expr}\`, () => {
 // TODO: implemente este passo
});`;
    });
    const code = `${imports}\n${banner}\n${blocks.join('\n\n')}\n`;
    // Embeleza o TS para manter padrão dos outros geradores
    return js_beautify_1.default.js(code, {
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
function generateSteps(destino, items, options = {}) {
    var _a, _b, _c, _d;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (!Array.isArray(items) || items.length === 0) {
                vscode.window.showWarningMessage('Nenhum cenário recebido para gerar steps.');
                return '';
            }
            // Garante existência do diretório 'AppDriver'
            const stepsDir = `${destino}/steps`;
            if (!utils_1.fs.existsSync(stepsDir)) {
                utils_1.fs.mkdirSync(stepsDir, { recursive: true });
            }
            // Base do nome do arquivo: reaproveita a mesma lógica do features
            const base = options.fileBaseName ||
                ((_b = (_a = items.find(it => it.issueKey)) === null || _a === void 0 ? void 0 : _a.issueKey) === null || _b === void 0 ? void 0 : _b.replace(/[^\w\-]/g, '_')) ||
                'scenarios';
            const fileName = `${base}Steps.js`;
            const filePath = path.join(stepsDir, fileName);
            // 1) Coleta todos os passos únicos a partir de todos os cenários
            const uniqueSteps = [];
            const memo = new Set();
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
                issueKey: (_c = items[0]) === null || _c === void 0 ? void 0 : _c.issueKey,
                issueId: (_d = items[0]) === null || _d === void 0 ? void 0 : _d.issueId,
                extraTags: options.extraTags,
            });
            // 3) Escreve o arquivo
            utils_1.fs.writeFileSync(filePath, code, 'utf8');
            vscode.window.showInformationMessage(`Arquivo ${fileName} (steps) gerado com sucesso!`);
            return filePath;
        }
        catch (err) {
            vscode.window.showErrorMessage(`Erro ao gerar steps: ${(err === null || err === void 0 ? void 0 : err.message) || err}`);
            return '';
        }
    });
}
exports.generateSteps = generateSteps;
