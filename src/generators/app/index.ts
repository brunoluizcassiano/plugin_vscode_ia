import yaml from 'js-yaml';
import * as fs from 'fs';
import { generateAppDriver, generateClassNameFromPath } from './appDriverGenerator';
import * as vscode from 'vscode';
/**
* Gera classes AppDriver e modelos de request body com base em um arquivo OpenAPI.
* @param openApiPath Caminho para o arquivo OpenAPI (YAML/JSON).
* @param endpoint (Opcional) Endpoint específico a ser gerado. Se não fornecido, gera para todos.
* @param generatePathAppDriver Diretório base onde os arquivos gerados serão salvos.
* @returns Promise que resolve quando a geração estiver concluída.
*/
export async function generateAppDriversFromOpenAPI(openApiPath: string, endpoint: string | undefined, generatePathAppDriver: string): Promise<void> {
 const fileContents = fs.readFileSync(openApiPath, 'utf8');
 const openApiDoc = yaml.load(fileContents) as { paths: Record<string, any> };
 const paths: Record<string, any> = openApiDoc.paths || {};
 
 if (endpoint) {
   // Gera apenas para um endpoint específico
   const className = generateClassNameFromPath(endpoint);
   const methods = Object.keys(paths[endpoint] || {});
   if (methods.length === 0) {
     vscode.window.showErrorMessage(`Endpoint "${endpoint}" não encontrado no OpenAPI.`);
   } else {
     await generateAppDriver(className, endpoint, methods, paths[endpoint], generatePathAppDriver);
   }
 } else {
   // Gera para todos os endpoints definidos em OpenAPI
   for (const endpointPath of Object.keys(paths)) {
     const className = generateClassNameFromPath(endpointPath);
     const methods = Object.keys(paths[endpointPath]);
     await generateAppDriver(className, endpointPath, methods, paths[endpointPath], generatePathAppDriver);
   }
 }
 vscode.window.showInformationMessage('Geração de AppDrivers concluída.');
}
