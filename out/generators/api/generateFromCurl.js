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
exports.generateModelFromCurl = exports.generateAppDriverFromCurl = void 0;
const parseCurl_1 = require("./parseCurl");
const modelGenerator_1 = require("./modelGenerator");
const appDriverGenerator_1 = require("./appDriverGenerator");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const js_beautify_1 = require("js-beautify");
const vscode = __importStar(require("vscode"));
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
function generateAppDriverFromCurl(curlString, outputDir) {
    return __awaiter(this, void 0, void 0, function* () {
        const parsed = (0, parseCurl_1.parseCurl)(curlString);
        const baseName = extractModelNameFromUrl(parsed.url);
        const modelName = `${baseName}Model`;
        const appDriverName = `${baseName}AppDriver`;
        // Garante diretório AppDriver
        const appDriverDirPath = path.join(outputDir, 'AppDriver');
        if (!fs.existsSync(appDriverDirPath)) {
            fs.mkdirSync(appDriverDirPath, { recursive: true });
        }
        // Geração do AppDriver
        const driverCode = (0, appDriverGenerator_1.generateAppDriver)(appDriverName, parsed, modelName);
        const driverPath = path.join(appDriverDirPath, `${appDriverName}.js`);
        const formattedDriver = (0, js_beautify_1.js)(driverCode, {
            indent_size: 2,
            space_in_empty_paren: true,
            end_with_newline: true,
        });
        try {
            fs.writeFileSync(driverPath, formattedDriver);
            vscode.window.showInformationMessage(`AppDriver ${appDriverName}.js gerado com sucesso!`);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Erro ao salvar AppDriver: ${err}`);
        }
    });
}
exports.generateAppDriverFromCurl = generateAppDriverFromCurl;
/**
* Gera os arquivos de Model.js (incluindo inner classes) e AppDriver.js a partir de um cURL
* @param curlString Conteúdo do cURL como string
* @param outputDir Diretório base onde os arquivos serão salvos
*/
function generateModelFromCurl(curlString, outputDir) {
    return __awaiter(this, void 0, void 0, function* () {
        const parsed = (0, parseCurl_1.parseCurl)(curlString);
        const baseName = extractModelNameFromUrl(parsed.url);
        const modelName = `${baseName}Model`;
        // Extrai e interpreta o body do cURL
        let bodyObj = {};
        try {
            bodyObj = JSON.parse(parsed.body || '{}');
        }
        catch (e) {
            console.warn('Body não é JSON válido. Usando string.');
            bodyObj = { raw: parsed.body || '' };
        }
        // Garante diretório Model
        const modelDirPath = path.join(outputDir, 'Model');
        if (!fs.existsSync(modelDirPath)) {
            fs.mkdirSync(modelDirPath, { recursive: true });
        }
        // Geração de Models
        const classes = (0, modelGenerator_1.generateClass)(modelName, bodyObj);
        for (const [fileName, code] of Object.entries(classes)) {
            const finalPath = path.join(modelDirPath, fileName);
            const formatted = (0, js_beautify_1.js)(code, {
                indent_size: 2,
                space_in_empty_paren: true,
                end_with_newline: true,
            });
            try {
                fs.writeFileSync(finalPath, formatted);
                vscode.window.showInformationMessage(`Model ${fileName} gerado com sucesso!`);
            }
            catch (err) {
                vscode.window.showErrorMessage(`Erro ao salvar ${fileName}: ${err}`);
            }
        }
    });
}
exports.generateModelFromCurl = generateModelFromCurl;
function extractModelNameFromUrl(url) {
    const parts = url.split('/');
    const last = parts.filter(Boolean).pop() || 'Request';
    return last.replace(/\W/g, '');
}
