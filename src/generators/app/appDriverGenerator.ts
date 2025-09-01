// appDriverGenerator.ts - Funções para gerar classes AppDriver de requisições
import { fs, capitalize } from '../utils/utils';
import { js as beautify } from 'js-beautify';
import * as vscode from 'vscode';
/** Verifica se um determinado método HTTP possui body de requisição no OpenAPI (aplica para POST, PUT, PATCH). */
function hasRequestBody(method: string, endpointMethods: Record<string, any>): boolean {
  return ['post', 'put', 'patch'].includes(method.toLowerCase()) && !!endpointMethods[method]?.requestBody;
}
/** Verifica se o endpoint exige autenticação (token) com base na definição de segurança no OpenAPI. */
function requiresAuth(endpointMethods: Record<string, any>): boolean {
  return !!(endpointMethods.security && endpointMethods.security.length > 0);
}
/** Gera o nome da classe AppDriver a partir do path do endpoint.
*  Exemplo: "/pet/{petId}/images" -> "petPetIdImagesAppDriver" (depois capitalizado -> PetPetIdImagesAppDriver).
*/
export function generateClassNameFromPath(endpointPath: string): string {
  const cleanedPath = endpointPath
    .replace(/\//g, ' ')
    .replace(/\{.*?\}/g, '')     // remove segmentos de path param {id}
    .replace(/[^a-zA-Z0-9 ]/g, '') // remove caracteres especiais
    .trim()
    .split(' ')
    .map((word, index) => index === 0
      ? word.toLowerCase()
      : word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
  return `${capitalize(cleanedPath)}AppDriver`;
}
/**
* Gera a classe AppDriver para um endpoint específico, criando métodos estáticos para cada método HTTP disponível.
* Cria o arquivo `<ClassName>.js` em `AppDriver/` com as funções de request usando Cypress.
*/
export async function generateAppDriver(className: string, endpointPath: string, methods: string[], endpointMethods: Record<string, any>, generatePathAppDriver: string): Promise<void> {
  let driverCode = `
/**
* @memberof ${className}
*/
class ${className} {
`;
  for (const method of methods) {
    const requiresBody = hasRequestBody(method, endpointMethods);
    const requiresToken = requiresAuth(endpointMethods);
    const opObject = endpointMethods[method];
    const queryParams = opObject.parameters?.filter((param: any) => param.in === 'query') || [];
    const pathParams = opObject.parameters?.filter((param: any) => param.in === 'path') || [];
    // Gera comentário (JSDoc) explicativo para o método
    driverCode += `
 /**
  * Faz uma requisição ${method.toUpperCase()} para o endpoint: '${endpointPath}'
  * @param {string} uri - A URL base para a requisição.
  * ${requiresBody ? "@param {Object} [data={}] - Corpo da requisição." : ""}
  * ${queryParams.length > 0 ? "@param {Object} [data.query] - Parâmetros de consulta (query params)." : ""}
  * ${pathParams.length > 0 ? "@param {Object} [data.pathParams] - Parâmetros de caminho para substituir na URL." : ""}
  * @param {string} [token=''] - Token de autenticação opcional.
  * @returns {Promise<Cypress.Response>} - Retorna uma promessa com a resposta da requisição (objeto Cypress.Response).
  *
  * @example
  * // Exemplo de uso da função gerada:
  * ${className}.request${capitalize(method)}(Cypress.env('baseUrl'), ${requiresBody ? "requestData, " : ""}Cypress.env('authToken'));
  */
 static async request${capitalize(method)}(uri, data = {}, token = '') {
   return new Cypress.Promise((resolve, reject) => {`;
    // Monta a URL com base no path e path params
    if (pathParams.length > 0) {
      // Substitui {param} por template ${data.param}
      driverCode += `
     const url = uri + \`${endpointPath.replace(/\{(.*?)\}/g, '${data.$1}')}\`;`;
    } else {
      driverCode += `
     const url = uri + '${endpointPath}';`;
    }
    // Configura a chamada cy.request com método, URL e parâmetros adequados
    driverCode += `
     cy.request({
       method: '${method.toUpperCase()}',
       url,`;
    if (requiresBody) {
      driverCode += `
       body: data.body || {},`;
    }
    if (queryParams.length > 0) {
      driverCode += `
       qs: data.query || {},`;
    }
    // Headers: adiciona Authorization se exigir token, e quaisquer headers extras fornecidos
    if (requiresToken || opObject.parameters?.some((param: any) => param.in === 'header')) {
      driverCode += `
       headers: {
         ${requiresToken ? "Authorization: token ? `Bearer ${token}` : undefined," : ""}
         ...data.headers
       },`;
    }
    driverCode += `
       failOnStatusCode: false
     }).then((response) => {
       // Log da requisição usando mecanismo de logging (exemplo plard)
       let jsonData = {
         "uri": uri,
         "path": '${endpointPath}',
         "reqType": '${method.toUpperCase()}',
         "headers": ${requiresToken || opObject.parameters?.some((p: any) => p.in === 'header') ? 'true' : 'false'},
         "token": ${requiresToken ? 'true' : 'false'},
         "body": data,
         "statusCode": response.status,
         "response": response.body
       };
       cy.plard.log.request(jsonData)
          .then(() => {
            resolve(response);
          });
     });
   });
 };
`;
  }
  driverCode += `
}
module.exports = ${className};
`;
  // Formata o código gerado para melhor legibilidade
  const formattedCode = beautify(driverCode, {
    indent_size: 2,
    space_in_empty_paren: true,
    end_with_newline: true,
  });
  // Garante existência do diretório 'AppDriver'
  const appDriverDir = `${generatePathAppDriver}/AppDriver`;
  if (!fs.existsSync(appDriverDir)) {
    fs.mkdirSync(appDriverDir, { recursive: true });
  }
  
  // Salva o arquivo da classe AppDriver
  const filePath = `${appDriverDir}/${className}.js`;
  try {
    fs.writeFileSync(filePath, formattedCode);
    vscode.window.showInformationMessage(`AppDriver ${className}.js gerado com sucesso!`);
  } catch (err) {
    vscode.window.showErrorMessage(`Erro ao escrever o arquivo AppDriver: ${err}`);
  }
}
