"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAppDriver = void 0;
function generateAppDriver(className, parsed, modelName) {
    return `
/**
* Classe responsável por realizar a requisição para ${parsed.url}
*/
class ${className} {
 /**
  * Executa a requisição ${parsed.method.toUpperCase()} com Cypress.
  * @param {string} uri - URL base da API.
  * @param {Object} [data={}] - Corpo da requisição.
  * @param {string} [token] - Token opcional de autenticação.
  * @returns {Promise<Cypress.Response<any>>}
  */
 static async request(uri, data = {}, token = '') {
   return new Cypress.Promise((resolve, reject) => {
     const url = uri + '${parsed.path}';
     cy.request({
       method: '${parsed.method.toUpperCase()}',
       url,
       body: data,
       failOnStatusCode: false
     }).then((response) => {
       // Realiza o log da requisição
       let jsonData = {
         "uri": uri,
         "path": '${parsed.path}',
         "reqType": '${parsed.method.toUpperCase()}',
         "headers": false,
         "body": data,
         "statusCode": response.status,
         "response": response.body
       };
       cy.plard.log.request(jsonData)
          .then(() => {
            resolve(response);
          })
     });
   });
 }
}
module.exports = ${className};
`.trim();
}
exports.generateAppDriver = generateAppDriver;
