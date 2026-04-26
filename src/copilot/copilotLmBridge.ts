import * as vscode from 'vscode';

type ChatMsg = vscode.LanguageModelChatMessage;
type ModelCandidate = { vendor: string; family?: string };

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

async function pickConfiguredModel(opts?: {
  candidates?: ModelCandidate[];
}): Promise<vscode.LanguageModelChat | null> {
  const cfg = vscode.workspace.getConfiguration();
  const provider = cfg.get<string>('plugin.ai.provider', 'auto');
  const family = cfg.get<string>('plugin.ai.modelFamily', '').trim();
  if (!opts?.candidates?.length && provider === 'auto') {
    const models = await vscode.lm.selectChatModels(family ? { family } : undefined);
    return models[0] ?? null;
  }

  const wanted = opts?.candidates?.length ? opts.candidates : configuredCandidates();
  for (const c of wanted) {
    const models = await vscode.lm.selectChatModels({ vendor: c.vendor, family: c.family });
    if (models.length) return models[0];
  }
  return null;
}

export async function listAvailableLmModels(): Promise<Array<{ id?: string; name?: string; vendor?: string; family?: string }>> {
  const seen = new Set<string>();
  const found: Array<{ id?: string; name?: string; vendor?: string; family?: string }> = [];
  const models = await vscode.lm.selectChatModels();

  for (const model of models as any[]) {
    const key = `${model.id || ''}|${model.vendor || ''}|${model.family || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({
      id: model.id,
      name: model.name,
      vendor: model.vendor,
      family: model.family,
    });
  }

  return found;
}

export async function askCopilotLm(
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
    throw new Error('Nenhum modelo de chat disponivel via vscode.lm. Verifique provider/modelo nas Settings.');
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

  console.log('Resposta completa da IA:', full);
  const answer = full.trim();
  if (!answer) {
    throw new Error('O modelo selecionado retornou uma resposta vazia.');
  }
  return answer;
}
