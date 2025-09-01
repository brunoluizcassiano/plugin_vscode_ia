export function getHomeViewContent(): string {
    return `
   <!DOCTYPE html>
   <html lang="pt-BR">
   <head>
   <meta charset="UTF-8">
   <title>CoE Qualidade - Home</title>
   <style>
          body {
            font-family: Segoe UI, sans-serif;
            background-color: #1e1e1e;
            color: white;
            padding: 2rem;
          }
          h2 {
            color: #00bfff;
          }
          .container {
            background-color: #2d2d2d;
            padding: 2rem;
            border-radius: 10px;
          }
          .btn {
            background-color: #007acc;
            color: white;
            border: none;
            padding: 1rem 2rem;
            margin: 0.5rem 0;
            border-radius: 5px;
            font-size: 1rem;
            width: 100%;
            cursor: pointer;
          }
          .btn:hover {
            background-color: #005f99;
          }
   </style>
   </head>
   <body>
   <div class="container">
   <h2>🏁 Bem-vindo ao CoE Qualidade - Plugin VS Code</h2>
   <p>Escolha uma das funcionalidades abaixo:</p>
   <button class="btn" onclick="vscode.postMessage({ command: 'openJira' })">📋 Jira</button>
   <button class="btn" onclick="vscode.postMessage({ command: 'openZephyr' })">🧪 Zephyr</button>
   <button class="btn" onclick="vscode.postMessage({ command: 'backend' })">📄 Backend</button>
   <button class="btn" onclick="navigate('web')">🌐 Web</button>
   <button class="btn" onclick="vscode.postMessage({ command: 'settings' })">⚙️ Configurar</button>
   </div>
   <script>
          const vscode = acquireVsCodeApi();
          function navigate(destino) {
            vscode.postMessage({
              type: 'navegar',
              destino
            });
          }
   </script>
   </body>
   </html>
    `;
   }
