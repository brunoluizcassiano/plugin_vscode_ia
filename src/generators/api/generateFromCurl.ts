import { parseCurl } from './parseCurl';
import { generateClass } from './modelGenerator';
import { generateAppDriver } from './appDriverGenerator';
import * as fs from 'fs';
import * as path from 'path';
import { js as beautify } from 'js-beautify';
import * as vscode from 'vscode';
// /**
// * Gera os arquivos de Model.js (incluindo inner classes) e AppDriver.js a partir de um cURL
// * @param curlString Conteúdo do cURL como string
// * @param outputDir Diretório base onde os arquivos serão salvos
// */
// export async function generateFromCurl(curlString: string, outputDir: string) {
//  const parsed = parseCurl(curlString);
//  const baseName = extractModelNameFromUrl(parsed.url);
//  const modelName = `${baseName}Model`;
//  const appDriverName = `${baseName}AppDriver`;
//  // Extrai e interpreta o body do cURL
//  let bodyObj: any = {};
//  try {
//    bodyObj = JSON.parse(parsed.body || '{}');
//  } catch (e) {
//    console.warn('Body não é JSON válido. Usando string.');
//    bodyObj = { raw: parsed.body || '' };
//  }
//  // Garante diretório Model
//  const modelDirPath = path.join(outputDir, 'Model');
//  if (!fs.existsSync(modelDirPath)) {
//    fs.mkdirSync(modelDirPath, { recursive: true });
//  }
//  // Garante diretório AppDriver
//  const appDriverDirPath = path.join(outputDir, 'AppDriver');
//  if (!fs.existsSync(appDriverDirPath)) {
//    fs.mkdirSync(appDriverDirPath, { recursive: true });
//  }
//  // Geração de Models
//  const classes = generateClass(modelName, bodyObj);
//  for (const [fileName, code] of Object.entries(classes)) {
//    const finalPath = path.join(modelDirPath, fileName);
//    const formatted = beautify(code, {
//      indent_size: 2,
//      space_in_empty_paren: true,
//      end_with_newline: true,
//    });
//    try {
//      fs.writeFileSync(finalPath, formatted);
//      vscode.window.showInformationMessage(`Model ${fileName} gerado com sucesso!`);
//    } catch (err) {
//      vscode.window.showErrorMessage(`Erro ao salvar ${fileName}: ${err}`);
//    }
//  }
//  // Geração do AppDriver
//  const driverCode = generateAppDriver(appDriverName, parsed, modelName);
//  const driverPath = path.join(appDriverDirPath, `${appDriverName}.js`);
//  const formattedDriver = beautify(driverCode, {
//    indent_size: 2,
//    space_in_empty_paren: true,
//    end_with_newline: true,
//  });
//  try {
//    fs.writeFileSync(driverPath, formattedDriver);
//    vscode.window.showInformationMessage(`AppDriver ${appDriverName}.js gerado com sucesso!`);
//  } catch (err) {
//    vscode.window.showErrorMessage(`Erro ao salvar AppDriver: ${err}`);
//  }
// }
/**
* Gera os arquivos de Model.js (incluindo inner classes) e AppDriver.js a partir de um cURL
* @param curlString Conteúdo do cURL como string
* @param outputDir Diretório base onde os arquivos serão salvos
*/
export async function generateAppDriverFromCurl(curlString: string, outputDir: string) {
  const parsed = parseCurl(curlString);
  const baseName = extractModelNameFromUrl(parsed.url);
  const modelName = `${baseName}Model`;
  const appDriverName = `${baseName}AppDriver`;
  // Garante diretório AppDriver
  const appDriverDirPath = path.join(outputDir, 'AppDriver');
  if (!fs.existsSync(appDriverDirPath)) {
    fs.mkdirSync(appDriverDirPath, { recursive: true });
  }
  
  // Geração do AppDriver
  const driverCode = generateAppDriver(appDriverName, parsed, modelName);
  const driverPath = path.join(appDriverDirPath, `${appDriverName}.js`);
  const formattedDriver = beautify(driverCode, {
    indent_size: 2,
    space_in_empty_paren: true,
    end_with_newline: true,
  });
  try {
    fs.writeFileSync(driverPath, formattedDriver);
    vscode.window.showInformationMessage(`AppDriver ${appDriverName}.js gerado com sucesso!`);
  } catch (err) {
    vscode.window.showErrorMessage(`Erro ao salvar AppDriver: ${err}`);
  }
 }
/**
* Gera os arquivos de Model.js (incluindo inner classes) e AppDriver.js a partir de um cURL
* @param curlString Conteúdo do cURL como string
* @param outputDir Diretório base onde os arquivos serão salvos
*/
export async function generateModelFromCurl(curlString: string, outputDir: string) {
  const parsed = parseCurl(curlString);
  const baseName = extractModelNameFromUrl(parsed.url);
  const modelName = `${baseName}Model`;
  // Extrai e interpreta o body do cURL
  let bodyObj: any = {};
  try {
    bodyObj = JSON.parse(parsed.body || '{}');
  } catch (e) {
    console.warn('Body não é JSON válido. Usando string.');
    bodyObj = { raw: parsed.body || '' };
  }
  // Garante diretório Model
  const modelDirPath = path.join(outputDir, 'Model');
  if (!fs.existsSync(modelDirPath)) {
    fs.mkdirSync(modelDirPath, { recursive: true });
  }
  // Geração de Models
  const classes = generateClass(modelName, bodyObj);
  for (const [fileName, code] of Object.entries(classes)) {
    const finalPath = path.join(modelDirPath, fileName);
    const formatted = beautify(code, {
      indent_size: 2,
      space_in_empty_paren: true,
      end_with_newline: true,
    });
    try {
      fs.writeFileSync(finalPath, formatted);
      vscode.window.showInformationMessage(`Model ${fileName} gerado com sucesso!`);
    } catch (err) {
      vscode.window.showErrorMessage(`Erro ao salvar ${fileName}: ${err}`);
    }
  }
 }
 function extractModelNameFromUrl(url: string): string {
  const parts = url.split('/');
  const last = parts.filter(Boolean).pop() || 'Request';
  return last.replace(/\W/g, '');
 }
