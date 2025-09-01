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
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAppDriver = exports.generateClassNameFromPath = void 0;
// appDriverGenerator.ts - Funções para gerar classes AppDriver de requisições
const utils_1 = require("../utils/utils");
const js_beautify_1 = require("js-beautify");
const vscode = __importStar(require("vscode"));
/** Verifica se um determinado método HTTP possui body de requisição no OpenAPI (aplica para POST, PUT, PATCH). */
function hasRequestBody(method, endpointMethods) {
    var _a;
    return ['post', 'put', 'patch'].includes(method.toLowerCase()) && !!((_a = endpointMethods[method]) === null || _a === void 0 ? void 0 : _a.requestBody);
}
/** Verifica se o endpoint exige autenticação (token) com base na definição de segurança no OpenAPI. */
function requiresAuth(endpointMethods) {
    return !!(endpointMethods.security && endpointMethods.security.length > 0);
}
/** Gera o nome da classe AppDriver a partir do path do endpoint.
*  Exemplo: "/pet/{petId}/images" -> "petPetIdImagesAppDriver" (depois capitalizado -> PetPetIdImagesAppDriver).
*/
function generateClassNameFromPath(endpointPath) {
    const cleanedPath = endpointPath
        .replace(/\//g, ' ')
        .replace(/\{.*?\}/g, '') // remove segmentos de path param {id}
        .replace(/[^a-zA-Z0-9 ]/g, '') // remove caracteres especiais
        .trim()
        .split(' ')
        .map((word, index) => index === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
    return `${(0, utils_1.capitalize)(cleanedPath)}AppDriver`;
}
exports.generateClassNameFromPath = generateClassNameFromPath;
/**
* Gera a classe AppDriver para um endpoint específico, criando métodos estáticos para cada método HTTP disponível.
* Cria o arquivo `<ClassName>.js` em `AppDriver/` com as funções de request usando Cypress.
*/
function generateAppDriver(className, endpointPath, methods, endpointMethods, generatePathAppDriver) {
    var _a, _b, _c, _d;
    return __awaiter(this, void 0, void 0, function* () {
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
            const queryParams = ((_a = opObject.parameters) === null || _a === void 0 ? void 0 : _a.filter((param) => param.in === 'query')) || [];
            const pathParams = ((_b = opObject.parameters) === null || _b === void 0 ? void 0 : _b.filter((param) => param.in === 'path')) || [];
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
  * ${className}.request${(0, utils_1.capitalize)(method)}(Cypress.env('baseUrl'), ${requiresBody ? "requestData, " : ""}Cypress.env('authToken'));
  */
 static async request${(0, utils_1.capitalize)(method)}(uri, data = {}, token = '') {
   return new Cypress.Promise((resolve, reject) => {`;
            // Monta a URL com base no path e path params
            if (pathParams.length > 0) {
                // Substitui {param} por template ${data.param}
                driverCode += `
     const url = uri + \`${endpointPath.replace(/\{(.*?)\}/g, '${data.$1}')}\`;`;
            }
            else {
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
            if (requiresToken || ((_c = opObject.parameters) === null || _c === void 0 ? void 0 : _c.some((param) => param.in === 'header'))) {
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
         "headers": ${requiresToken || ((_d = opObject.parameters) === null || _d === void 0 ? void 0 : _d.some((p) => p.in === 'header')) ? 'true' : 'false'},
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
        const formattedCode = (0, js_beautify_1.js)(driverCode, {
            indent_size: 2,
            space_in_empty_paren: true,
            end_with_newline: true,
        });
        // Garante existência do diretório 'AppDriver'
        const appDriverDir = `${generatePathAppDriver}/AppDriver`;
        if (!utils_1.fs.existsSync(appDriverDir)) {
            utils_1.fs.mkdirSync(appDriverDir, { recursive: true });
        }
        // Salva o arquivo da classe AppDriver
        const filePath = `${appDriverDir}/${className}.js`;
        try {
            utils_1.fs.writeFileSync(filePath, formattedCode);
            vscode.window.showInformationMessage(`AppDriver ${className}.js gerado com sucesso!`);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Erro ao escrever o arquivo AppDriver: ${err}`);
        }
    });
}
exports.generateAppDriver = generateAppDriver;
