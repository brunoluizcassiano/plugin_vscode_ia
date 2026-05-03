import * as vscode from 'vscode';
import { detectHostKind } from '../../platform/hostContext';

type ChatMsg = vscode.LanguageModelChatMessage;
type ModelCandidate = { vendor: string; family?: string };
type FallbackChatModelInfo = { id?: string; name?: string; vendor?: string; family?: string };

const WINDSURF_VENDORS = ['windsurf', 'codeium', 'cascade', 'devin'];
const VSCODE_VENDORS = ['copilot', 'github', 'openai', 'codex'];
const COMMON_FAMILIES = ['gpt-4o', 'gpt-4o-mini', 'claude-3.5-sonnet', 'claude-3.7-sonnet', 'sonnet', 'code'];

function debugLm(message: string, extra?: unknown) {
    try {
        if (typeof extra === 'undefined') {
            console.log(`[plugin.lm] ${message}`);
            return;
        }
        console.log(`[plugin.lm] ${message}`, extra);
    } catch { }
}

function normalizeVendor(vendor?: string): string {
    return (vendor || '').trim().toLowerCase();
}

function dedupeCandidates(candidates: ModelCandidate[]): ModelCandidate[] {
    const seen = new Set<string>();
    return candidates.filter(candidate => {
        const key = `${normalizeVendor(candidate.vendor)}|${(candidate.family || '').trim().toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function hostProbeCandidates(): ModelCandidate[] {
    const host = detectHostKind();
    const orderedVendors = host === 'windsurf'
        ? [...WINDSURF_VENDORS, ...VSCODE_VENDORS]
        : [...VSCODE_VENDORS, ...WINDSURF_VENDORS];

    return dedupeCandidates([
        ...orderedVendors.flatMap(vendor => COMMON_FAMILIES.map(family => ({ vendor, family }))),
        ...orderedVendors.map(vendor => ({ vendor })),
    ]);
}

async function selectChatModelsSafe(selector?: { vendor?: string; family?: string }) {
    try {
        const models = await vscode.lm.selectChatModels(selector);
        debugLm(`selectChatModels(${JSON.stringify(selector || {})}) -> ${models.length}`);
        return models;
    } catch (error) {
        debugLm(`selectChatModels(${JSON.stringify(selector || {})}) failed`, error);
        return [] as vscode.LanguageModelChat[];
    }
}

async function collectModelsForCandidate(candidate: ModelCandidate) {
    const attempts = dedupeCandidates([
        { vendor: candidate.vendor, family: candidate.family },
        { vendor: candidate.vendor },
        ...(candidate.family ? [{ vendor: '', family: candidate.family }] : []),
    ]);

    const collected: vscode.LanguageModelChat[] = [];
    const seen = new Set<string>();
    for (const attempt of attempts) {
        const selector = {
            vendor: attempt.vendor || undefined,
            family: attempt.family || undefined,
        };
        const models = await selectChatModelsSafe(selector);
        for (const model of models) {
            const key = `${(model as any)?.id || ''}|${normalizeVendor((model as any)?.vendor)}|${((model as any)?.family || '').toLowerCase()}`;
            if (seen.has(key)) continue;
            seen.add(key);
            collected.push(model);
        }
    }
    return collected;
}

function pushModel(
    seen: Set<string>,
    found: Array<{ id?: string; name?: string; vendor?: string; family?: string }>,
    model: any
) {
    const vendor = normalizeVendor(model?.vendor);
    const family = (model?.family || '').trim();
    const key = `${model?.id || ''}|${vendor}|${family.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({
        id: model?.id,
        name: model?.name,
        vendor: vendor || model?.vendor,
        family: family || undefined,
    });
}

function extractText(part: any): string {
    if (!part) return '';
    if (typeof part === 'string') return part;
    if (typeof part.text === 'string') return part.text;
    if (typeof part.value === 'string') return part.value;
    if (Array.isArray(part)) return part.map(extractText).join('');
    if (part.part && typeof part.part.value === 'string') return part.part.value;
    if (part.delta && typeof part.delta === 'string') return part.delta;
    return '';
}

function getDevinConfig() {
    const cfg = vscode.workspace.getConfiguration();
    return {
        orgSlug: cfg.get<string>('plugin.ai.devinOrgSlug', '').trim(),
        apiKey: cfg.get<string>('plugin.ai.devinApiKey', '').trim(),
    };
}

function hasDevinFallbackConfig() {
    const cfg = getDevinConfig();
    return !!(cfg.orgSlug && cfg.apiKey);
}

async function callDevinApi(prompt: string, opts?: {
    system?: string;
    temperature?: number;
    onDeltaText?: (chunk: string) => void;
}): Promise<string> {
    const cfg = getDevinConfig();
    if (!cfg.orgSlug || !cfg.apiKey) {
        throw new Error('Devin API não configurado. Preencha Organization e API Key nas Settings.');
    }

    const fullPrompt = opts?.system?.trim()
        ? `${opts.system.trim()}\n\n${prompt}`
        : prompt;

    const baseUrl = 'https://api.devinenterprise.com/v1';
    debugLm(`callDevinApi creating session org=${cfg.orgSlug}`);

    const createResponse = await fetch(`${baseUrl}/sessions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
            prompt: fullPrompt,
        }),
    });

    if (!createResponse.ok) {
        const errorText = await createResponse.text();
        debugLm(`callDevinApi create session failed status=${createResponse.status}`, errorText);
        throw new Error(`Devin API retornou ${createResponse.status}: ${errorText || createResponse.statusText}`);
    }

    const sessionData = await createResponse.json() as any;
    const sessionId = sessionData?.session_id;
    const sessionUrl = sessionData?.url || `https://santander-sgc.devinenterprise.com/sessions/${sessionId}`;

    if (!sessionId) {
        throw new Error('Devin API não retornou session_id.');
    }

    debugLm(`callDevinApi session created id=${sessionId} url=${sessionUrl}`);

    const maxWaitMs = 300000;
    const pollIntervalMs = 5000;
    const startTime = Date.now();
    let lastStatus = '';
    let lastMessageCount = 0;

    while (Date.now() - startTime < maxWaitMs) {
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));

        const statusResponse = await fetch(`${baseUrl}/sessions/${sessionId}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${cfg.apiKey}`,
            },
        });

        if (!statusResponse.ok) {
            debugLm(`callDevinApi poll failed status=${statusResponse.status}`);
            continue;
        }

        const statusData = await statusResponse.json() as any;
        const status = statusData?.status_enum || statusData?.status;
        const statusDetail = statusData?.status_detail;
        const messages = statusData?.messages || [];

        if (status !== lastStatus) {
            debugLm(`callDevinApi session status=${status} detail=${statusDetail} messages=${messages.length}`);
            lastStatus = status;
        }

        if (messages.length > lastMessageCount) {
            lastMessageCount = messages.length;
            const latestMsg = messages[messages.length - 1];
            if (latestMsg?.message && opts?.onDeltaText) {
                debugLm(`callDevinApi new message: ${latestMsg.message.substring(0, 100)}...`);
            }
        }

        if (status === 'finished' || status === 'stopped' || status === 'blocked') {
            const devinMessages = messages.filter((m: any) =>
                m.type === 'devin_message' || m.type === 'assistant' || m.sender === 'devin'
            );

            if (devinMessages.length > 0) {
                const lastDevinMsg = devinMessages[devinMessages.length - 1];
                const response = lastDevinMsg?.message || lastDevinMsg?.content || '';
                if (response) {
                    debugLm(`callDevinApi got devin response: ${response.substring(0, 200)}...`);
                    opts?.onDeltaText?.(String(response));
                    return String(response);
                }
            }

            if (statusData?.structured_output) {
                const output = typeof statusData.structured_output === 'string'
                    ? statusData.structured_output
                    : JSON.stringify(statusData.structured_output, null, 2);
                opts?.onDeltaText?.(output);
                return output;
            }

            if (messages.length > 0) {
                const allResponses = messages
                    .filter((m: any) => m.message || m.content)
                    .map((m: any) => m.message || m.content)
                    .join('\n\n');
                if (allResponses) {
                    opts?.onDeltaText?.(allResponses);
                    return allResponses;
                }
            }

            const fallbackResult = statusData?.title || `Sessão ${status}. Sem resposta textual disponível.`;
            opts?.onDeltaText?.(fallbackResult);
            return fallbackResult;
        }

        if (status === 'error' || status === 'failed') {
            throw new Error(`Sessão do Devin falhou: ${statusDetail || status}`);
        }
    }

    const finalResponse = await fetch(`${baseUrl}/sessions/${sessionId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${cfg.apiKey}` },
    });

    if (finalResponse.ok) {
        const finalData = await finalResponse.json() as any;
        const messages = finalData?.messages || [];
        const devinMessages = messages.filter((m: any) =>
            m.type === 'devin_message' || m.type === 'assistant' || m.sender === 'devin'
        );

        if (devinMessages.length > 0) {
            const lastDevinMsg = devinMessages[devinMessages.length - 1];
            const response = lastDevinMsg?.message || lastDevinMsg?.content || '';
            if (response) {
                opts?.onDeltaText?.(String(response));
                return String(response);
            }
        }
    }

    throw new Error(`Timeout aguardando resposta do Devin. A sessão ainda está em andamento: ${sessionUrl}`);
}

function getDevinFallbackModelInfo(): FallbackChatModelInfo[] {
    const cfg = getDevinConfig();
    if (!cfg.orgSlug || !cfg.apiKey) return [];
    return [{
        id: 'devin-enterprise',
        name: 'Devin Enterprise',
        vendor: 'devin',
        family: 'devin',
    }];
}

function configuredCandidates(): ModelCandidate[] {
    const cfg = vscode.workspace.getConfiguration();
    const provider = cfg.get<string>('plugin.ai.provider', 'auto');
    const customVendor = cfg.get<string>('plugin.ai.vendor', '').trim();
    const customFamily = cfg.get<string>('plugin.ai.modelFamily', '').trim();
    const modelSelector = (vendor: string): ModelCandidate => customFamily ? { vendor, family: customFamily } : { vendor };

    if (provider && provider !== 'auto' && !['custom', 'copilot', 'codex', 'devin'].includes(provider)) {
        return [modelSelector(provider)];
    }
    if (provider === 'custom' && customVendor) return [modelSelector(customVendor)];
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

    return dedupeCandidates([
        ...(customVendor ? [modelSelector(customVendor)] : []),
        ...(detectHostKind() === 'windsurf'
            ? [modelSelector('windsurf'), modelSelector('codeium'), modelSelector('cascade'), modelSelector('devin')]
            : []),
        { vendor: 'copilot', family: 'gpt-4o' },
        { vendor: 'copilot', family: 'gpt-4o-mini' },
        { vendor: 'copilot' },
        { vendor: 'github' },
        { vendor: 'openai' },
        { vendor: 'codex' },
        { vendor: 'devin' },
    ]);
}

async function pickConfiguredModel(opts?: {
    candidates?: ModelCandidate[];
}): Promise<vscode.LanguageModelChat | null> {
    const cfg = vscode.workspace.getConfiguration();
    const provider = cfg.get<string>('plugin.ai.provider', 'auto');
    const family = cfg.get<string>('plugin.ai.modelFamily', '').trim();
    const host = detectHostKind();
    if (!opts?.candidates?.length && provider === 'auto' && host !== 'windsurf') {
        const models = await selectChatModelsSafe(family ? { family } : undefined);
        return models[0] ?? null;
    }

    const wanted = dedupeCandidates([
        ...(opts?.candidates?.length ? opts.candidates : configuredCandidates()),
        ...(provider === 'auto' ? hostProbeCandidates() : []),
    ]);
    for (const c of wanted) {
        const models = host === 'windsurf'
            ? await collectModelsForCandidate(c)
            : await selectChatModelsSafe({ vendor: c.vendor, family: c.family });
        if (models.length) return models[0];
    }
    if (host === 'windsurf') {
        const fallback = await selectChatModelsSafe(family ? { family } : undefined);
        if (fallback.length) return fallback[0];
        const anyModels = await selectChatModelsSafe();
        if (anyModels.length) return anyModels[0];
    }
    return null;
}

export async function listAvailableLanguageModels(): Promise<Array<{ id?: string; name?: string; vendor?: string; family?: string }>> {
    const seen = new Set<string>();
    const found: Array<{ id?: string; name?: string; vendor?: string; family?: string }> = [];
    const host = detectHostKind();

    if (host !== 'windsurf') {
        const models = await selectChatModelsSafe();
        for (const model of models as any[]) {
            pushModel(seen, found, model);
        }
        return found;
    }

    for (const candidate of hostProbeCandidates()) {
        const models = await collectModelsForCandidate(candidate);
        for (const model of models as any[]) {
            pushModel(seen, found, model);
        }
    }

    if (!found.length) {
        for (const model of await selectChatModelsSafe() as any[]) {
            pushModel(seen, found, model);
        }
    }

    if (!found.length) {
        for (const family of COMMON_FAMILIES) {
            for (const model of await selectChatModelsSafe({ family }) as any[]) {
                pushModel(seen, found, model);
            }
        }
    }

    if (!found.length && hasDevinFallbackConfig()) {
        for (const model of getDevinFallbackModelInfo()) {
            pushModel(seen, found, model as any);
        }
    }

    debugLm(`listAvailableLanguageModels host=${host} found=${found.length}`, found.map(model => ({ vendor: model.vendor, family: model.family, id: model.id, name: model.name })));

    return found;
}

export async function askLanguageModel(
    prompt: string,
    opts?: {
        system?: string;
        temperature?: number;
        onDeltaText?: (chunk: string) => void;
        candidates?: ModelCandidate[];
    }
): Promise<string> {
    const model = await pickConfiguredModel(opts);

    if (!model) {
        if (hasDevinFallbackConfig()) {
            debugLm('askLanguageModel: no vscode.lm model, using Devin fallback');
            return callDevinApi(prompt, opts);
        }
        throw new Error('Nenhum modelo de chat disponivel via vscode.lm. Configure o Devin nas Settings para usar IA no Windsurf.');
    }

    const finalPrompt = opts?.system ? `${opts.system}\n\n${prompt}` : prompt;
    const msgs: ChatMsg[] = [
        vscode.LanguageModelChatMessage.User(finalPrompt),
    ];

    const req: any = {};
    if (typeof opts?.temperature === 'number') req.temperature = opts.temperature;

    const res = await model.sendRequest(
        msgs,
        req as vscode.LanguageModelChatRequestOptions,
        new vscode.CancellationTokenSource().token
    );

    const readText = async (response: vscode.LanguageModelChatResponse, preferText: boolean) => {
        let text = '';
        const textStream = preferText ? ((response as any).text as AsyncIterable<string> | undefined) : undefined;
        const stream = textStream ?? (response.stream as AsyncIterable<any>);
        for await (const raw of stream) {
            const chunk = textStream ? String(raw || '') : extractText(raw);
            if (!chunk) continue;
            text += chunk;
            opts?.onDeltaText?.(chunk);
        }
        return text;
    };

    let full = '';
    try {
        full = await readText(res, true);
        if (!full.trim()) {
            const retry = await model.sendRequest(
                msgs,
                req as vscode.LanguageModelChatRequestOptions,
                new vscode.CancellationTokenSource().token
            );
            full = await readText(retry, false);
        }
    } catch (e: any) {
        vscode.window.showErrorMessage(`Erro ao processar resposta da IA: ${e?.message ?? e}`);
        return 'Erro ao processar resposta da IA.';
    }
    console.log('Prompt enviado para IA:', finalPrompt);
    console.log('Resposta completa da IA:', full);
    const answer = full.trim();
    if (!answer) {
        throw new Error('O modelo selecionado retornou uma resposta vazia.');
    }
    return answer;
}

export const listAvailableLmModels = listAvailableLanguageModels;
export const askCopilotLm = askLanguageModel;
