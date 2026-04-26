export function getSettingsViewContent(): string {
 return /* html */ `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Settings — Plugin QA</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"/>
<style>
:root { --bg:#1e1e1e; --card:#2d2d2d; --muted:#9aa0a6; --inp:#3a3a3a; --focus:#61dafb; --ok:#2e7d32; --warn:#e53935; }
body{font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:var(--bg);color:#fff;padding:2rem}
.container{background:var(--card);padding:2rem;border-radius:10px;max-width:880px;margin:0 auto}
h2{color:var(--focus);margin:0 0 1.25rem}
h3{margin:18px 0 10px;color:#fff}
.grid{display:grid;grid-template-columns:1fr;gap:14px}
label{font-weight:600;font-size:.92rem}
.row{display:flex;gap:8px;align-items:center}
.hint{color:var(--muted);font-size:.8rem}
input,button,select{border:none;border-radius:8px;background:var(--inp);color:#fff;padding:.7rem .9rem;width:93%}
input:focus{outline:2px solid var(--focus)}
select:focus{outline:2px solid var(--focus)}
.actions{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap}
button:hover{cursor:pointer;filter:brightness(1.1)}
.pw{position:relative}
.pw input{padding-right:40px}
.pw .eye{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:transparent;border:0;width:auto;padding:0;opacity:.8}
.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media (max-width:720px){ .two{grid-template-columns:1fr} }
/* De/Para */
.map-card{margin-top:14px;padding:14px;border:1px dashed #444;border-radius:8px;background:#262626}
.map-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.map-header .title{font-weight:700}
.map-actions{display:flex;gap:10px}
.map-row{display:grid;grid-template-columns:1fr 24px 1fr 36px;gap:10px;align-items:center;margin:8px 0}
.map-row input{width:100%}
.map-row .arrow{opacity:.8;text-align:center}
.map-row .minus{width:36px;height:36px;border-radius:8px}
#btnAddMap{width:auto}
.badge{font-size:.75rem;background:#3a3a3a;padding:.25rem .5rem;border-radius:6px;color:#ddd}
#status.ok{color:var(--ok)}
#status.err{color:var(--warn)}
.switch{display:flex;align-items:center;gap:8px;margin-top:6px}
.switch input{width:auto}
.empty-hint{color:var(--muted);font-size:.85rem;margin:6px 0 0}
</style>
</head>
<body>
<div class="container">
<h2><i class="fa-solid fa-gear"></i> Settings</h2>
<div class="grid">
<!-- JIRA -->
<div class="two">
<div>
<label for="plugin.jira.domain">Jira Domain</label>
<input id="plugin.jira.domain" placeholder="ex.: group-project-org.atlassian.net" />
</div>
<div>
<label for="plugin.jira.email">Jira Email</label>
<input id="plugin.jira.email" placeholder="nome@empresa.com" />
</div>
</div>
<div class="pw">
<label for="plugin.jira.token">Jira Token</label>
<input id="plugin.jira.token" type="password" placeholder="********"/>
<button class="eye" type="button" data-target="plugin.jira.token" title="Mostrar/ocultar">
<i class="fa-regular fa-eye"></i>
</button>
</div>
<div>
<label for="plugin.jira.projectCategoryId">Jira Project Category ID</label>
<input id="plugin.jira.projectCategoryId" placeholder="ex.: 10018 (deixe vazio para listar todos)" />
<div class="hint">Quando preenchido, usa <code>/project/search?categoryId=...</code>. Quando vazio, usa <code>/project</code>.</div>
</div>
<!-- ZEPHYR -->
<!-- IA -->
<div class="map-card">
<div class="map-header">
<div class="title">
<h3 style="margin:0;">IA / Language Model</h3>
<div class="hint">Usa a API <code>vscode.lm</code>, funcionando com modelos expostos por VS Code ou Windsurf.</div>
</div>
</div>
<div class="two">
<div>
<label for="plugin.ai.provider">Provider</label>
<select id="plugin.ai.provider"></select>
</div>
<div>
<label for="plugin.ai.modelFamily">Modelo / Family</label>
<select id="plugin.ai.modelFamily"></select>
</div>
</div>
<div class="actions">
<button id="btnDetectModels" type="button"><i class="fa-solid fa-magnifying-glass"></i> Atualizar modelos</button>
</div>
<div class="hint" id="aiModels"></div>
</div>
<!-- ZEPHYR -->
<div class="two">
<div>
<label for="plugin.zephyr.domain">Zephyr Domain</label>
<input id="plugin.zephyr.domain" placeholder="ex.: api.zephyrscale.smartbear.com" />
</div>
<div>
<label for="plugin.zephyr.ownerId">Owner ID</label>
<input id="plugin.zephyr.ownerId" placeholder="ex.: 7122005-..." />
</div>
</div>
<div class="pw">
<label for="plugin.zephyr.token">Zephyr Token</label>
<input id="plugin.zephyr.token" type="password" placeholder="********"/>
<button class="eye" type="button" data-target="plugin.zephyr.token" title="Mostrar/ocultar">
<i class="fa-regular fa-eye"></i>
</button>
</div>
<!-- DE/PARA -->
<div class="map-card">
<div class="map-header">
<div class="title">
<h3 style="margin:0;">De/Para de Projetos — <span class="badge">Jira → Zephyr</span></h3>
<div class="hint">Se não houver mapeamento para um projeto, <b>usaremos o próprio key do Jira</b> (não quebra nada).</div>
<label class="switch">
<input type="checkbox" id="plugin.projectMap.strict"/>
<span>Exigir de/para (modo estrito)</span>
</label>
</div>
<div class="map-actions">
<button id="btnAddMap" title="Adicionar mapeamento"><i class="fa-solid fa-plus"></i> Adicionar</button>
</div>
</div>
<div id="mapList"></div>
<div class="empty-hint" id="mapEmptyHint" style="display:none;">Nenhum mapeamento cadastrado. Isso é ok — o plugin manterá o mesmo key do Jira no Zephyr.</div>
</div>
<div class="actions">
<button id="btnSave"><i class="fa-solid fa-floppy-disk"></i> Salvar</button>
<button id="btnReload"><i class="fa-solid fa-rotate"></i> Recarregar</button>
<button id="btnOpenJson"><i class="fa-regular fa-file-code"></i> Abrir settings.json</button>
</div>
<div class="hint" id="status"></div>
</div>
</div>
<script>
const vscode = acquireVsCodeApi();
// Campos "simples"
const KEYS = [
 "plugin.jira.domain",
 "plugin.jira.email",
 "plugin.jira.token",
 "plugin.jira.projectCategoryId",
 "plugin.ai.provider",
 "plugin.ai.modelFamily",
 "plugin.zephyr.ownerId",
 "plugin.zephyr.domain",
 "plugin.zephyr.token"
];
// ---------- utils ----------
function uid() { return Math.random().toString(36).slice(2); }
function upcase(el){
 el.addEventListener('change', ()=>{ el.value = (el.value||'').trim().toUpperCase(); });
}
function setStatus(msg, ok=false, err=false){
 const s = document.getElementById("status");
 s.textContent = msg || "";
 s.className = ok ? "hint ok" : (err ? "hint err" : "hint");
}
// ---------- De/Para DOM ----------
const mapList   = document.getElementById('mapList');
const mapEmpty  = document.getElementById('mapEmptyHint');
const strictChk = document.getElementById('plugin.projectMap.strict');
let currentSettings = {};
let availableModels = [];
function renderEmptyHint(){
 mapEmpty.style.display = mapList.children.length ? 'none' : 'block';
}
function addMapRow(jiraKey = "", zephyrKey = ""){
 const id = uid();
 const row = document.createElement('div');
 row.className = 'map-row';
row.dataset.id = id;
 row.innerHTML = \`
<input class="jiraKey" placeholder="JIRA (ex.: TBTX)" maxlength="20" value="\${jiraKey}">
<div class="arrow">→</div>
<input class="zephyrKey" placeholder="ZEPHYR (ex.: SQTC)" maxlength="20" value="\${zephyrKey}">
<button class="minus" title="Remover" type="button"><i class="fa-solid fa-minus"></i></button>
 \`;
 const j = row.querySelector('.jiraKey');
 const z = row.querySelector('.zephyrKey');
 upcase(j); upcase(z);
 row.querySelector('.minus').addEventListener('click', ()=>{
   row.remove();
   renderEmptyHint();
 });
 mapList.appendChild(row);
 renderEmptyHint();
}
const KEY_RE = /^[A-Z0-9_-]{1,20}$/;
function renderMap(obj){
 mapList.innerHTML = "";
 if (obj && typeof obj === 'object'){
   Object.entries(obj).forEach(([jira, val])=>{
     if (!KEY_RE.test(String(jira).toUpperCase())) return;       // ignora inválidos
     if (String(jira).toUpperCase() === 'STRICT') return;         // proteção extra
     const zephyr = (typeof val === 'string') ? val : (val && val.zephyrKey) ? val.zephyrKey : "";
     if (!zephyr) return;
     addMapRow(String(jira).toUpperCase(), String(zephyr).toUpperCase());
   });
 }
 renderEmptyHint();
}
function collectMap(){
 const map = {};
 let hasDup = false;
 const seen = new Set();
 Array.from(mapList.querySelectorAll('.map-row')).forEach(row=>{
   const jira = (row.querySelector('.jiraKey').value || '').trim().toUpperCase();
   const zep  = (row.querySelector('.zephyrKey').value || '').trim().toUpperCase();
   if(!jira || !zep) return; // ignora linhas vazias
   if(seen.has(jira)){
     hasDup = true;
   }
   seen.add(jira);
   map[jira] = zep;
 });
 return { map, hasDup };
}
// ---------- preenchimento ----------
function fill(values){
 currentSettings = values || {};
 KEYS.forEach(k=>{
   const el = document.getElementById(k);
   if(el) el.value = values?.[k] ?? "";
 });
 // de/para
 strictChk.checked = !!values?.["plugin.projectMap.strict"];
 renderMap(values?.["plugin.projectMap"] || {});
 vscode.postMessage({ type: "detectAiModels" });
}
function unique(items){
 return Array.from(new Set(items.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}
function renderAiOptions(){
 const providerSelect = document.getElementById("plugin.ai.provider");
 const modelSelect = document.getElementById("plugin.ai.modelFamily");
 const savedProvider = currentSettings?.["plugin.ai.provider"] || "";
 const savedModel = currentSettings?.["plugin.ai.modelFamily"] || "";
 const vendors = unique(availableModels.map(m => m.vendor));

 providerSelect.innerHTML = "";
 if (!vendors.length) {
   providerSelect.innerHTML = '<option value="">Nenhum provider disponivel</option>';
   modelSelect.innerHTML = '<option value="">Nenhum modelo disponivel</option>';
   providerSelect.disabled = true;
   modelSelect.disabled = true;
   return;
 }

 providerSelect.disabled = false;
 modelSelect.disabled = false;
 vendors.forEach(vendor => {
   const opt = document.createElement("option");
   opt.value = vendor;
   opt.textContent = vendor;
   providerSelect.appendChild(opt);
 });
 providerSelect.value = vendors.includes(savedProvider) ? savedProvider : vendors[0];
 renderModelOptions(savedModel);
}
function renderModelOptions(savedModel){
 const providerSelect = document.getElementById("plugin.ai.provider");
 const modelSelect = document.getElementById("plugin.ai.modelFamily");
 const vendor = providerSelect.value;
 const models = availableModels.filter(m => m.vendor === vendor);
 modelSelect.innerHTML = "";
 models.forEach(model => {
   const value = model.family || model.id || model.name || "";
   if (!value) return;
   const opt = document.createElement("option");
   opt.value = value;
   opt.textContent = [model.family, model.name || model.id].filter(Boolean).join(" - ");
   modelSelect.appendChild(opt);
 });
 if (!modelSelect.options.length) {
   modelSelect.innerHTML = '<option value="">Modelo padrao</option>';
 }
 const values = Array.from(modelSelect.options).map(o => o.value);
 modelSelect.value = values.includes(savedModel) ? savedModel : modelSelect.options[0].value;
}
// pedir os valores atuais
vscode.postMessage({ type: "loadSettings" });
// eventos principais
document.getElementById("btnSave").addEventListener("click", ()=>{
 const settings = {};
 KEYS.forEach(k=>{
   const el = document.getElementById(k);
   settings[k] = el ? el.value.trim() : "";
 });
 const { map, hasDup } = collectMap();
 settings["plugin.projectMap"] = map;
 settings["plugin.projectMap.strict"] = !!strictChk.checked;
 if (hasDup){
   setStatus("Existem chaves Jira duplicadas no De/Para. Corrija antes de salvar.", false, true);
   return;
 }
 vscode.postMessage({ type: "saveSettings", settings });
});
document.getElementById("btnReload").addEventListener("click", ()=>{
 vscode.postMessage({ type: "loadSettings" });
});
document.getElementById("btnOpenJson").addEventListener("click", ()=>{
 vscode.postMessage({ type: "openSettingsJson" });
});
document.getElementById("btnDetectModels").addEventListener("click", ()=>{
 const aiModels = document.getElementById("aiModels");
 aiModels.textContent = "Detectando modelos...";
 vscode.postMessage({ type: "detectAiModels" });
});
document.getElementById("plugin.ai.provider").addEventListener("change", ()=>{
 renderModelOptions("");
});
document.getElementById("btnAddMap").addEventListener("click", ()=>{
 addMapRow();
});
// mostrar/ocultar senha
document.querySelectorAll(".eye").forEach(btn=>{
 btn.addEventListener("click", ()=>{
   const id = btn.dataset.target;
   const input = document.getElementById(id);
   if(!input) return;
   input.type = input.type === "password" ? "text" : "password";
   btn.innerHTML = input.type === "password"
     ? '<i class="fa-regular fa-eye"></i>'
     : '<i class="fa-regular fa-eye-slash"></i>';
 });
});
// mensagens do extension host
window.addEventListener("message", ev=>{
 const msg = ev.data;
 if(msg.type === "currentSettings") fill(msg.values);
 if(msg.type === "status") {
   setStatus(msg.message || "", !!msg.ok, !!msg.err);
 }
 if(msg.type === "aiModels") {
   const aiModels = document.getElementById("aiModels");
   availableModels = Array.isArray(msg.models) ? msg.models : [];
   renderAiOptions();
   aiModels.textContent = availableModels.length
     ? availableModels.map(m => [m.vendor, m.family, m.name || m.id].filter(Boolean).join(" / ")).join("\\n")
     : "Nenhum modelo encontrado via vscode.lm.";
 }
});
</script>
</body>
</html>
`;
}
