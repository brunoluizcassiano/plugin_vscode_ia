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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAppDriversFromOpenAPI = void 0;
const js_yaml_1 = __importDefault(require("js-yaml"));
const fs = __importStar(require("fs"));
const appDriverGenerator_1 = require("./appDriverGenerator");
const vscode = __importStar(require("vscode"));
/**
* Gera classes AppDriver e modelos de request body com base em um arquivo OpenAPI.
* @param openApiPath Caminho para o arquivo OpenAPI (YAML/JSON).
* @param endpoint (Opcional) Endpoint específico a ser gerado. Se não fornecido, gera para todos.
* @param generatePathAppDriver Diretório base onde os arquivos gerados serão salvos.
* @returns Promise que resolve quando a geração estiver concluída.
*/
function generateAppDriversFromOpenAPI(openApiPath, endpoint, generatePathAppDriver) {
    return __awaiter(this, void 0, void 0, function* () {
        const fileContents = fs.readFileSync(openApiPath, 'utf8');
        const openApiDoc = js_yaml_1.default.load(fileContents);
        const paths = openApiDoc.paths || {};
        if (endpoint) {
            // Gera apenas para um endpoint específico
            const className = (0, appDriverGenerator_1.generateClassNameFromPath)(endpoint);
            const methods = Object.keys(paths[endpoint] || {});
            if (methods.length === 0) {
                vscode.window.showErrorMessage(`Endpoint "${endpoint}" não encontrado no OpenAPI.`);
            }
            else {
                yield (0, appDriverGenerator_1.generateAppDriver)(className, endpoint, methods, paths[endpoint], generatePathAppDriver);
            }
        }
        else {
            // Gera para todos os endpoints definidos em OpenAPI
            for (const endpointPath of Object.keys(paths)) {
                const className = (0, appDriverGenerator_1.generateClassNameFromPath)(endpointPath);
                const methods = Object.keys(paths[endpointPath]);
                yield (0, appDriverGenerator_1.generateAppDriver)(className, endpointPath, methods, paths[endpointPath], generatePathAppDriver);
            }
        }
        vscode.window.showInformationMessage('Geração de AppDrivers concluída.');
    });
}
exports.generateAppDriversFromOpenAPI = generateAppDriversFromOpenAPI;
