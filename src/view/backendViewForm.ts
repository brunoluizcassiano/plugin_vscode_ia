export function getBackendviewContent(): string {
  return `
 <!DOCTYPE html>
 <html lang="pt-BR">
 <head>
 <meta charset="UTF-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0">
 <title>Formulário Dinâmico</title>
 <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
 <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
        background-color: #1e1e1e;
        color: #ffffff;
        padding: 2rem;
      }
      .container {
        background-color: #2d2d2d;
        padding: 2rem;
        border-radius: 10px;
        max-width: 800px;
        margin: 0 auto;
        display: block;
      }
      h2 {
        color: #61dafb;
        margin-bottom: 16px;
      }
      form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        background-color: #2d2d2d;
        padding: 20px;
        border-radius: 10px;
        transition: all 0.3s ease-in-out;
      }
      label {
        font-weight: 500;
        margin-bottom: 4px;
      }
      select, textarea, button {
        padding: 8px;
        border-radius: 5px;
        border: none;
        width: 100%;
        background-color: #3a3a3a;
        color: #fff;
        transition: background-color 0.2s;
      }
      select:focus, textarea:focus, button:focus {
        outline: 2px solid #61dafb;
      }
      button:hover {
        background-color: #505050;
        cursor: pointer;
      }
      .checkbox-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .hidden {
        display: none;
      }
      .file-button, .folder-button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .info {
        color: #cccccc;
        font-size: 0.9em;
        margin-top: 4px;
      }
      .file-picker {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .file-path {
        color: #aaaaaa;
        font-size: 0.85em;
        word-break: break-all;
        margin-left: 4px;
        padding-left: 4px;
        border-left: 2px solid #444;
        margin-bottom: 16px;
      }
      .method-checkbox {
        display: flex;
        align-items: center;
        margin-bottom: 5px;
        font-family: sans-serif;
        font-size: 0.9rem;
      }
      .method-checkbox input[type="checkbox"] {
        margin-right: 8px;
      }
      #methodsContainer {
        margin-top: 0.5rem;
        margin-bottom: 1rem;
        padding-left: 5px;
        border-left: 3px solid #444;
      }
 </style>
 </head>
 <body>
 <div class="container">
 <h2><i class="fa-solid fa-code"></i> Backend</h2>
 <form id="formulario" onsubmit="handleSubmit(event)">
 <label for="tipo"><i class="fa-solid fa-list"></i> Escolha o tipo:</label>
 <select id="tipo" name="tipo" onchange="handleTipoChange()">
 <option value="">Selecione</option>
 <option value="curl">Curl</option>
 <option value="schema">Schema</option>
 </select>
 <div id="campo-curl" class="hidden">
 <label for="curl"><i class="fa-solid fa-terminal"></i> Cole o comando curl:</label>
 <textarea id="curl" name="curl" rows="6" style="width: 100%;"></textarea>
 <label>Selecione os itens que deseja gerar:</label>
 <div class="checkbox-group">
 <label><input type="checkbox" id="modelCurl" name="modelCurl" value="modeluCurl"> Model</label>
 <label><input type="checkbox" id="appDriverCurl" name="appDriverCurl" value="appDriverCurl"> AppDriver</label> 
 </div>
 </div>
 <div id="campo-schema" class="hidden">
 <div class="file-picker">
 <label><i class="fa-solid fa-file-code"></i> Arquivo schema:</label>
 <button type="button" onclick="selecionarArquivo()">
 <i class="fa-solid fa-folder-open"></i> Selecionar arquivo
 </button>
 <div id="arquivoSelecionado" class="file-path"></div>
 </div>
 <label for="tipo"><i class="fa-solid fa-list"></i> Selecione o endpoint:</label>
 <select id="selectEndpoint" name="endpoint" style="width: 100%; margin-bottom: 1rem;">
 <option value="">-- Selecione um endpoint --</option>
 </select>
 <div id="methodsContainer" style="margin-top: 1rem;">
 <!-- Os checkboxes dos métodos HTTP aparecerão aqui -->
 </div>
 <label for="tipo"><i class="fa-solid fa-list"></i> Selecione os itens que deseja gerar:</label>
 <div id="methodsContainer" style="margin-top: 1rem;">
 <div class="method-checkbox">
 <label><input type="checkbox" id="schema" name="schema" value="schema"> Schema</label>
  </div>
  <div class="method-checkbox">
 <label><input type="checkbox" id="model" name="model" value="model"> Model</label>
 </div>
  <div class="method-checkbox">
 <label><input type="checkbox" id="appDriver" name="appDriver" value="appDriver"> AppDriver</label>
 </div>
 </div>
 </div>
 <label><i class="fa-solid fa-folder"></i> Pasta de destino:</label>
 <button type="button" class="folder-button" onclick="selecionarPasta()">
 <i class="fa-solid fa-folder-tree"></i> Selecionar pasta
 </button>
 <span id="pastaSelecionada" class="info"></span>
 <button type="submit"><i class="fa-solid fa-paper-plane"></i> Enviar</button>
 </form>
 </div>
 <script>
      const vscode = acquireVsCodeApi();
      let caminhoSchema = null;
      let caminhoPasta = null;
      function handleTipoChange() {
        const tipo = document.getElementById('tipo').value;
        document.getElementById('campo-curl').classList.toggle('hidden', tipo !== 'curl');
        document.getElementById('campo-schema').classList.toggle('hidden', tipo !== 'schema');
      }
      function selecionarArquivo() {
        vscode.postMessage({ type: 'selecionarArquivoSchema' });
      }
      function selecionarPasta() {
        vscode.postMessage({ type: 'selecionarPastaDestino' });
      }
      
      function handleSubmit(event) {
        event.preventDefault();
        const tipo = document.getElementById('tipo').value;
        const curl = document.getElementById('curl')?.value;
        const endPoint = document.getElementById('selectEndpoint')?.value;
        const schema = document.getElementById('schema')?.checked;
        const model = document.getElementById('model')?.checked;
        const appDriver = document.getElementById('appDriver')?.checked;
        const modelCurl = document.getElementById('modelCurl')?.checked;
        const appDriverCurl = document.getElementById('appDriverCurl')?.checked;
        if (tipo === 'schema' && !schema && !model && !appDriver) {
          alert('Selecione pelo menos uma opção: Schema, Model ou AppDriver.');
          return;
        }
        if (tipo === 'curl' && !modelCurl && !appDriverCurl) {
          alert('Selecione pelo menos uma opção: Model ou AppDriver.');
          return;
        }
        vscode.postMessage({
          type: 'formularioPreenchido',
          dados: {
            tipo,
            curl: tipo === 'curl' ? curl : null,
            endPointUri: endPoint,
            arquivo: caminhoSchema,
            pasta: caminhoPasta,
            gerar: tipo === 'schema' ? { schema, model, appDriver } : tipo === 'curl' ? { modelCurl, appDriverCurl } : null
          }
        });
      }
        
      window.addEventListener('message', event => {
        const message = event.data;
        if (message.type === 'schemaSelecionado') {
          caminhoSchema = message.caminho;
          document.getElementById('arquivoSelecionado').innerText = caminhoSchema;
          if (message.endpoints && Array.isArray(message.endpoints)) {
            const select = document.getElementById('selectEndpoint');
            const methodsDiv = document.getElementById('methodsContainer');
            // Preenche o select com os endpoints
            select.innerHTML = '<option value="">-- Selecione um endpoint --</option>';
            select.dataset.endpoints = JSON.stringify(message.endpoints); // guarda os dados
            message.endpoints.forEach(({ path }) => {
              const option = document.createElement('option');
              option.value = path;
              option.textContent = path;
              select.appendChild(option);
            });
            // Limpa os checkboxes ao trocar schema
            methodsDiv.innerHTML = '';
          }
        }
        if (message.type === 'pastaSelecionada') {
          caminhoPasta = message.caminho;
          document.getElementById('pastaSelecionada').innerText = caminhoPasta;
        }
      });
      // Quando o usuário selecionar um endpoint, atualiza os checkboxes de métodos
      document.getElementById('selectEndpoint').addEventListener('change', (e) => {
      const selectedPath = e.target.value;
      const endpoints = JSON.parse(e.target.dataset.endpoints || '[]');
      const methodsDiv = document.getElementById('methodsContainer');
      methodsDiv.innerHTML = '';
      const match = endpoints.find(ep => ep.path === selectedPath);
      if (match && match.methods.length) {
        match.methods.forEach(method => {
          const label = document.createElement('label');
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.name = 'methods';
          checkbox.value = method;
          label.appendChild(checkbox);
          label.appendChild(document.createTextNode(' ' + method.toUpperCase()));
          const wrapper = document.createElement('div');
          wrapper.className = 'method-checkbox';
          wrapper.appendChild(label);
          methodsDiv.appendChild(wrapper);
          methodsDiv.appendChild(document.createElement('br'));
        });
      }
      });
 </script>
 </body>
 </html>
  `;
}
