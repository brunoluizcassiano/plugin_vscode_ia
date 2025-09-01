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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.yaml = exports.path = exports.fs = exports.capitalize = exports.singularize = exports.beautify = void 0;
// utils.ts - Funções utilitárias e inicializações de libs
// Importações de bibliotecas padrão e de terceiros
const fs = __importStar(require("fs"));
exports.fs = fs;
const path = __importStar(require("path"));
exports.path = path;
const js_yaml_1 = __importDefault(require("js-yaml"));
exports.yaml = js_yaml_1.default;
const js_beautify_1 = __importDefault(require("js-beautify"));
// Exporta instâncias ou funções utilitárias necessárias em outros módulos
exports.beautify = js_beautify_1.default.js; // Função de formatação de código JavaScript
/**
* Remove sufixos plurais simples de uma string (inglês).
* Ex: "categories" -> "category"; "users" -> "user".
*/
function singularize(name) {
    if (typeof name !== 'string')
        return '';
    const lower = name.toLowerCase();
    if (lower.endsWith('ies')) {
        return name.slice(0, -3) + 'y';
    }
    else if (lower.endsWith('es')) {
        return name.slice(0, -2);
    }
    else if (lower.endsWith('s')) {
        return name.slice(0, -1);
    }
    return name;
}
exports.singularize = singularize;
/**
* Capitaliza a primeira letra de uma string.
* Ex: "example" -> "Example".
*/
function capitalize(str) {
    if (typeof str !== 'string') {
        throw new Error('Expected a string to capitalize');
    }
    return str.charAt(0).toUpperCase() + str.slice(1);
}
exports.capitalize = capitalize;
