"use strict";
// stepsGenerator.ts
// Gera steps em JS, evita duplicados varrendo a pasta "cypress" (se presente no caminho),
// não cria/salva arquivo quando não há steps novos, e retorna um relatório estruturado (sem HTML).
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSteps = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/* ===================== Helpers: Gherkin -> pares <TYPE>|<expr> ===================== */
// function cleanGherkin(raw: string): string {
//   if (!raw) return "";
//   const fenced = /```(?:gherkin)?\s*([\s\S]*?)```/i;
//   const m = raw.match(fenced);
//   const content = m ? m[1] : raw;
//   return content
//     .split("\n")
//     .map((l) => l.replace(/^\s+/, ""))
//     .filter((l) => l.trim() !== "")
//     .join("\n");
// }
function cleanGherkin(raw) {
    if (!raw)
        return "";
    const fenced = /```(?:gherkin)?\s*([\s\S]*?)```/i;
    const m = raw.match(fenced);
    let content = m ? m[1] : raw;
    // ✅ Normaliza CR/LF e converte "\n" literais em quebras reais
    content = content
        .replace(/\\r\\n|\\n|\\r/g, "\n") // barra+n -> newline real
        .replace(/\r\n?/g, "\n"); // CRLF/LF -> LF
    return content
        .split("\n")
        .map(l => l.replace(/^\s+/, "")) // remove indent
        .filter(l => l.trim() !== "") // remove linhas vazias
        .join("\n");
}
function extractStepsFromGherkin(gherkin) {
    const lines = cleanGherkin(gherkin).split("\n");
    const stepRe = /^(Given|When|Then|And|But|Dado|Quando|Então|Entao|E|Mas)\b/i;
    const unique = new Map();
    let lastType = null;
    for (const raw of lines) {
        const line = raw.trim();
        if (!line || line.startsWith("#") || line.startsWith("@"))
            continue;
        if (/^(Feature|Rule|Scenario(?: Outline)?):/i.test(line)) {
            lastType = null;
            continue;
        }
        const m = line.match(stepRe);
        if (!m)
            continue;
        // normaliza keyword para Given/When/Then
        let type = m[1];
        if (/^(And|E|But|Mas)$/i.test(type)) {
            type = (lastType || "Given");
        }
        else if (/^Dado$/i.test(type)) {
            type = "Given";
        }
        else if (/^Quando$/i.test(type)) {
            type = "When";
        }
        else if (/^(Então|Entao)$/i.test(type)) {
            type = "Then";
        }
        else {
            type = (type[0].toUpperCase() + type.slice(1).toLowerCase());
        }
        lastType = type;
        const text = line.replace(stepRe, "").trim();
        // Normalização estilo Cucumber Expressions
        const expr = text
            .replace(/"[^"]*"/g, "{string}")
            .replace(/'[^']*'/g, "{string}")
            .replace(/\b-?\d+\.\d+\b/g, "{float}")
            .replace(/\b-?\d+\b/g, "{int}")
            .replace(/\s+/g, " ")
            .trim();
        const key = `${type}|${expr}`;
        if (!unique.has(key))
            unique.set(key, { type: type, expr });
    }
    return Array.from(unique.values());
}
/* ===================== Helpers: scanner de steps existentes ===================== */
const VALID_STEP_EXT = /\.(ts|js)$/i;
const IGNORE_DTYPES = /\.d\.ts$/i;
function readdirDeepSync(dir) {
    const out = [];
    if (!fs.existsSync(dir))
        return out;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory())
            out.push(...readdirDeepSync(full));
        else
            out.push(full);
    }
    return out;
}
/** Converte regex literal para placeholders aproximados */
function regexToCucumberExpr(src) {
    let s = src;
    s = s.replace(/^\^/, "").replace(/\$$/, "");
    s = s
        .replace(/\(-?\\d+\.\d+\)/g, "{float}")
        .replace(/\(-?\d+\.\d+\)/g, "{float}")
        .replace(/\(-?\\d+\)/g, "{int}")
        .replace(/\(-?\d+\)/g, "{int}")
        .replace(/\(".*?"\)/g, "{string}")
        .replace(/\('.*?'\)/g, "{string}")
        .replace(/\(\.\+\)/g, "{string}")
        .replace(/\(\.\*\)/g, "{string}");
    return s.replace(/\s+/g, " ").trim();
}
function normalizeStepExpressionFromFile(exprRaw, wasRegex = false) {
    let s = exprRaw;
    if (wasRegex) {
        s = regexToCucumberExpr(s);
    }
    else {
        if ((s.startsWith("`") && s.endsWith("`")) ||
            (s.startsWith('"') && s.endsWith('"')) ||
            (s.startsWith("'") && s.endsWith("'"))) {
            s = s.slice(1, -1);
        }
        s = s
            .replace(/"[^"]*"/g, "{string}")
            .replace(/'[^']*'/g, "{string}")
            .replace(/\b-?\d+\.\d+\b/g, "{float}")
            .replace(/\b-?\d+\b/g, "{int}");
    }
    return s.replace(/\s+/g, " ").trim();
}
/** Extrai pares com locais do conteúdo de um arquivo de steps */
function extractPairsWithLocations(content, filePath, out) {
    // Given/When/Then com string/template
    const strPat = /\b(Given|When|Then)\s*\(\s*([`'"])((?:\\.|(?!\2).)+)\2\s*,/g;
    // defineStep com string/template
    const defPat = /\bdefineStep\s*\(\s*([`'"])((?:\\.|(?!\1).)+)\1\s*,/g;
    // Given/When/Then com regex literal
    const rxPat = /\b(Given|When|Then)\s*\(\s*\/((?:\\\/|[^\/])+?)\/[gimsuy]*\s*,/g;
    // defineStep com regex literal
    const defRxPat = /\bdefineStep\s*\(\s*\/((?:\\\/|[^\/])+?)\/[gimsuy]*\s*,/g;
    let m;
    const push = (pairKey) => {
        const arr = out.get(pairKey) || [];
        arr.push(filePath);
        out.set(pairKey, Array.from(new Set(arr)));
    };
    while ((m = strPat.exec(content)) !== null) {
        const type = m[1];
        const expr = normalizeStepExpressionFromFile(m[3], false);
        push(`${type}|${expr}`);
    }
    while ((m = defPat.exec(content)) !== null) {
        const expr = normalizeStepExpressionFromFile(m[2], false);
        push(`Given|${expr}`);
        push(`When|${expr}`);
        push(`Then|${expr}`);
    }
    while ((m = rxPat.exec(content)) !== null) {
        const type = m[1];
        const expr = normalizeStepExpressionFromFile(m[2], true);
        push(`${type}|${expr}`);
    }
    while ((m = defRxPat.exec(content)) !== null) {
        const expr = normalizeStepExpressionFromFile(m[1], true);
        push(`Given|${expr}`);
        push(`When|${expr}`);
        push(`Then|${expr}`);
    }
}
/** Encontra a raiz da pasta "cypress" dentro do caminho informado (se existir) */
function findCypressRootFrom(destino) {
    const norm = path.resolve(destino);
    const parts = norm.split(path.sep);
    const idx = parts.lastIndexOf("cypress");
    if (idx === -1)
        return null;
    return parts.slice(0, idx + 1).join(path.sep); // .../cypress
}
/** Coleta pares existentes sob a pasta cypress/ mapeando -> [arquivos] */
function collectExistingPairsUnderCypressWithLocations(destino) {
    const map = new Map();
    const cypressRoot = findCypressRootFrom(destino);
    if (!cypressRoot || !fs.existsSync(cypressRoot))
        return map;
    const files = readdirDeepSync(cypressRoot).filter((f) => VALID_STEP_EXT.test(f) && !IGNORE_DTYPES.test(f));
    for (const f of files) {
        try {
            const content = fs.readFileSync(f, "utf8");
            extractPairsWithLocations(content, f, map);
        }
        catch ( /* ignore */_a) { /* ignore */ }
    }
    return map;
}
/* ===================== Construção de código JS ===================== */
function buildJsBlocks(pairs) {
    return pairs
        .map(({ type, expr }) => {
        return `${type}(\`${expr}\`, (..._args) => {
  // TODO: implemente este passo
});`;
    })
        .join("\n\n");
}
function ensureImportPresent(content) {
    const importLine = `import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor';`;
    const re = new RegExp(`^\\s*import\\s*\\{\\s*Given\\s*,\\s*When\\s*,\\s*Then\\s*\\}\\s*from\\s*['"]@badeball\\/cypress-cucumber-preprocessor['"];?`, "m");
    if (!re.test(content)) {
        return `${importLine}\n\n${content.trim()}\n`;
    }
    return content;
}
/* ===================== Função principal (assinatura mantida) ===================== */
function generateSteps(destino, items, options = {}) {
    var _a, _b, _c;
    return __awaiter(this, void 0, void 0, function* () {
        const report = {
            status: "skipped-no-new",
            filePath: "",
            createdCount: 0,
            created: [],
            skipped: [],
            errors: []
        };
        try {
            if (!Array.isArray(items) || items.length === 0) {
                report.errors.push("Nenhum cenário recebido para gerar steps.");
                report.status = "error";
                return report;
            }
            const baseName = (options.fileBaseName || ((_a = items[0]) === null || _a === void 0 ? void 0 : _a.key) || "scenarios")
                .toString()
                .trim()
                .replace(/[^\w.-]+/g, "_")
                .toLowerCase();
            // Arquivo de saída: Steps.js (JS!)
            const stepsDir = path.join(destino, "steps");
            const fileName = `${baseName}Steps.js`;
            const filePath = path.join(stepsDir, fileName);
            report.filePath = filePath;
            // 1) Extrai passos dos itens
            const fromItemsPairs = new Map();
            for (const it of items) {
                for (const pair of extractStepsFromGherkin(it.gherkin || "")) {
                    const key = `${pair.type}|${pair.expr}`;
                    if (!fromItemsPairs.has(key))
                        fromItemsPairs.set(key, pair);
                }
            }
            // 2) Dedup global sob /cypress se aplicável (com locais)
            const existingInCypress = collectExistingPairsUnderCypressWithLocations(destino);
            // 3) Dedup local (arquivo alvo) — mesmo se não houver /cypress
            const existingInTargetFile = new Map();
            if (fs.existsSync(filePath)) {
                try {
                    const current = fs.readFileSync(filePath, "utf8");
                    extractPairsWithLocations(current, filePath, existingInTargetFile);
                }
                catch ( /* ignore */_d) { /* ignore */ }
            }
            // 4) Separa criados vs pulados (com locais)
            const toCreate = [];
            for (const [key, pair] of fromItemsPairs.entries()) {
                const locations = [
                    ...(existingInCypress.get(key) || []),
                    ...(existingInTargetFile.get(key) || [])
                ];
                if (locations.length > 0) {
                    report.skipped.push({ pair, locations });
                }
                else {
                    toCreate.push(pair);
                }
            }
            if (toCreate.length === 0) {
                // nenhum novo: não cria/atualiza arquivo
                report.status = "skipped-no-new";
                return report;
            }
            // 5) Só cria a pasta steps se realmente vamos escrever
            if (!fs.existsSync(stepsDir))
                fs.mkdirSync(stepsDir, { recursive: true });
            // 6) Monta conteúdo JS
            const banner = `/**
 * Arquivo gerado automaticamente.
 * Ajuste os corpos dos steps conforme necessário.
 *
 * Metadados:
 *   tribe: ${options.tribeName || "-"}
 *   issueKey: ${((_b = items[0]) === null || _b === void 0 ? void 0 : _b.issueKey) || "-"}
 *   issueId: ${((_c = items[0]) === null || _c === void 0 ? void 0 : _c.issueId) || "-"}
 *   extraTags: ${options.extraTags || "-"}
 */`;
            const newBlocks = buildJsBlocks(toCreate);
            let finalContent = "";
            if (fs.existsSync(filePath)) {
                // append ao final do arquivo existente
                const current = fs.readFileSync(filePath, "utf8");
                const withImport = ensureImportPresent(current);
                finalContent = `${withImport.trim()}\n\n${newBlocks}\n`;
            }
            else {
                // novo arquivo
                finalContent = ensureImportPresent(`${banner}\n\n${newBlocks}\n`);
            }
            fs.writeFileSync(filePath, finalContent, "utf8");
            report.created = toCreate;
            report.createdCount = toCreate.length;
            report.status = "created";
            return report;
        }
        catch (err) {
            report.errors.push((err === null || err === void 0 ? void 0 : err.message) || String(err));
            report.status = "error";
            return report;
        }
    });
}
exports.generateSteps = generateSteps;
