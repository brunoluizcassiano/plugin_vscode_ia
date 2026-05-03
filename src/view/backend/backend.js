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
      gerar: tipo === 'schema'
        ? { schema, model, appDriver }
        : tipo === 'curl'
          ? { modelCurl, appDriverCurl }
          : null
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
      select.innerHTML = '<option value="">-- Selecione um endpoint --</option>';
      select.dataset.endpoints = JSON.stringify(message.endpoints);
      message.endpoints.forEach(({ path }) => {
        const option = document.createElement('option');
        option.value = path;
        option.textContent = path;
        select.appendChild(option);
      });
      methodsDiv.innerHTML = '';
    }
  }

  if (message.type === 'pastaSelecionada') {
    caminhoPasta = message.caminho;
    document.getElementById('pastaSelecionada').innerText = caminhoPasta;
  }
});

document.getElementById('tipo')?.addEventListener('change', handleTipoChange);
document.getElementById('btnSelecionarArquivo')?.addEventListener('click', selecionarArquivo);
document.getElementById('btnSelecionarPasta')?.addEventListener('click', selecionarPasta);
document.getElementById('formulario')?.addEventListener('submit', handleSubmit);

document.getElementById('selectEndpoint')?.addEventListener('change', e => {
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
