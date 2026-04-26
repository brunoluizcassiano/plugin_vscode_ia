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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.askCopilotLm = exports.listAvailableLmModels = void 0;
const vscode = __importStar(require("vscode"));
function extractText(part) {
    if (!part)
        return '';
    if (typeof part === 'string')
        return part;
    if (typeof part.text === 'string')
        return part.text;
    if (typeof part.value === 'string')
        return part.value;
    if (Array.isArray(part))
        return part.map(extractText).join('');
    if (part.part && typeof part.part.value === 'string')
        return part.part.value;
    if (part.delta && typeof part.delta === 'string')
        return part.delta;
    return '';
}
function configuredCandidates() {
    const cfg = vscode.workspace.getConfiguration();
    const provider = cfg.get('plugin.ai.provider', 'auto');
    const customVendor = cfg.get('plugin.ai.vendor', '').trim();
    const customFamily = cfg.get('plugin.ai.modelFamily', '').trim();
    const modelSelector = (vendor) => customFamily ? { vendor, family: customFamily } : { vendor };
    if (provider && provider !== 'auto' && !['custom', 'copilot', 'codex', 'devin'].includes(provider)) {
        return [modelSelector(provider)];
    }
    if (provider === 'custom' && customVendor)
        return [modelSelector(customVendor)];
    if (provider === 'copilot') {
        return customFamily
            ? [{ vendor: 'copilot', family: customFamily }, { vendor: 'github', family: customFamily }]
            : [{ vendor: 'copilot' }, { vendor: 'github' }];
    }
    if (provider === 'codex') {
        return customFamily
            ? [{ vendor: 'openai', family: customFamily }, { vendor: 'codex', family: customFamily }]
            : [{ vendor: 'openai' }, { vendor: 'codex' }];
    }
    if (provider === 'devin') {
        return customFamily ? [{ vendor: 'devin', family: customFamily }] : [{ vendor: 'devin' }];
    }
    return [
        ...(customVendor ? [modelSelector(customVendor)] : []),
        { vendor: 'copilot', family: 'gpt-4o' },
        { vendor: 'copilot', family: 'gpt-4o-mini' },
        { vendor: 'copilot' },
        { vendor: 'github' },
        { vendor: 'openai' },
        { vendor: 'codex' },
        { vendor: 'devin' },
    ];
}
function pickConfiguredModel(opts) {
    var _a, _b, _c;
    return __awaiter(this, void 0, void 0, function* () {
        const cfg = vscode.workspace.getConfiguration();
        const provider = cfg.get('plugin.ai.provider', 'auto');
        const family = cfg.get('plugin.ai.modelFamily', '').trim();
        if (!((_a = opts === null || opts === void 0 ? void 0 : opts.candidates) === null || _a === void 0 ? void 0 : _a.length) && provider === 'auto') {
            const models = yield vscode.lm.selectChatModels(family ? { family } : undefined);
            return (_b = models[0]) !== null && _b !== void 0 ? _b : null;
        }
        const wanted = ((_c = opts === null || opts === void 0 ? void 0 : opts.candidates) === null || _c === void 0 ? void 0 : _c.length) ? opts.candidates : configuredCandidates();
        for (const c of wanted) {
            const models = yield vscode.lm.selectChatModels({ vendor: c.vendor, family: c.family });
            if (models.length)
                return models[0];
        }
        return null;
    });
}
function listAvailableLmModels() {
    return __awaiter(this, void 0, void 0, function* () {
        const seen = new Set();
        const found = [];
        const models = yield vscode.lm.selectChatModels();
        for (const model of models) {
            const key = `${model.id || ''}|${model.vendor || ''}|${model.family || ''}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            found.push({
                id: model.id,
                name: model.name,
                vendor: model.vendor,
                family: model.family,
            });
        }
        return found;
    });
}
exports.listAvailableLmModels = listAvailableLmModels;
function askCopilotLm(prompt, opts) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const model = yield pickConfiguredModel(opts);
        if (!model) {
            throw new Error('Nenhum modelo de chat disponivel via vscode.lm. Verifique provider/modelo nas Settings.');
        }
        const finalPrompt = (opts === null || opts === void 0 ? void 0 : opts.system) ? `${opts.system}\n\n${prompt}` : prompt;
        const msgs = [
            vscode.LanguageModelChatMessage.User(finalPrompt),
        ];
        const req = {};
        if (typeof (opts === null || opts === void 0 ? void 0 : opts.temperature) === 'number')
            req.temperature = opts.temperature;
        const res = yield model.sendRequest(msgs, req, new vscode.CancellationTokenSource().token);
        const readText = (response, preferText) => __awaiter(this, void 0, void 0, function* () {
            var _b, e_1, _c, _d;
            var _e;
            let text = '';
            const textStream = preferText ? response.text : undefined;
            const stream = textStream !== null && textStream !== void 0 ? textStream : response.stream;
            try {
                for (var _f = true, stream_1 = __asyncValues(stream), stream_1_1; stream_1_1 = yield stream_1.next(), _b = stream_1_1.done, !_b;) {
                    _d = stream_1_1.value;
                    _f = false;
                    try {
                        const raw = _d;
                        const chunk = textStream ? String(raw || '') : extractText(raw);
                        if (!chunk)
                            continue;
                        text += chunk;
                        (_e = opts === null || opts === void 0 ? void 0 : opts.onDeltaText) === null || _e === void 0 ? void 0 : _e.call(opts, chunk);
                    }
                    finally {
                        _f = true;
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_f && !_b && (_c = stream_1.return)) yield _c.call(stream_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return text;
        });
        let full = '';
        try {
            full = yield readText(res, true);
            if (!full.trim()) {
                const retry = yield model.sendRequest(msgs, req, new vscode.CancellationTokenSource().token);
                full = yield readText(retry, false);
            }
        }
        catch (e) {
            vscode.window.showErrorMessage(`Erro ao processar resposta da IA: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`);
            return 'Erro ao processar resposta da IA.';
        }
        console.log('Resposta completa da IA:', full);
        const answer = full.trim();
        if (!answer) {
            throw new Error('O modelo selecionado retornou uma resposta vazia.');
        }
        return answer;
    });
}
exports.askCopilotLm = askCopilotLm;
