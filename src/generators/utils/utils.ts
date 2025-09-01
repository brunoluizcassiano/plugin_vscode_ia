// utils.ts - Funções utilitárias e inicializações de libs
// Importações de bibliotecas padrão e de terceiros
import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';
import beautifyLib from 'js-beautify';
// Exporta instâncias ou funções utilitárias necessárias em outros módulos
export const beautify = beautifyLib.js;  // Função de formatação de código JavaScript
/**
* Remove sufixos plurais simples de uma string (inglês).
* Ex: "categories" -> "category"; "users" -> "user".
*/
export function singularize(name: string): string {
 if (typeof name !== 'string') return '';
 const lower = name.toLowerCase();
 if (lower.endsWith('ies')) {
   return name.slice(0, -3) + 'y';
 } else if (lower.endsWith('es')) {
   return name.slice(0, -2);
 } else if (lower.endsWith('s')) {
   return name.slice(0, -1);
 }
 return name;
}
/**
* Capitaliza a primeira letra de uma string.
* Ex: "example" -> "Example".
*/
export function capitalize(str: string): string {
 if (typeof str !== 'string') {
   throw new Error('Expected a string to capitalize');
 }
 return str.charAt(0).toUpperCase() + str.slice(1);
}
// Reexporta fs, path e yaml para conveniência de outros módulos
export { fs, path, yaml };
