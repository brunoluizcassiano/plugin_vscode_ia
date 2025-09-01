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
exports.generateClassNameFromPath = exports.generateRequestBodyClasses = exports.verifyRequestBodySubClasses = exports.generateRequestBodyClass = void 0;
// modelGenerator.ts - Funções para gerar classes de modelo de request body
const js_beautify_1 = require("js-beautify");
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const utils_1 = require("../utils/utils");
const openApiUtils_1 = require("../utils/openApiUtils");
// import generateClass from './generateClass';
const vscode = __importStar(require("vscode"));
const multiTypeMap = {};
/**
 * Gera o código de uma classe ListModel para um determinado nome base.
 * Essa classe encapsula uma lista de objetos do tipo base, com métodos de adição, remoção e serialização.
 */
function generateListClass(baseName) {
    const itemClass = `${baseName}Model`;
    return `
class ${baseName}ListModel {
  constructor(items) {
    this.items = [];
    if (items) {
      this.set(items);
    }
  }
  add(item) {
    if (!(item instanceof ${itemClass})) {
      throw new Error('Expected item to be an instance of ${itemClass}');
    }
    this.items.push(item);
  }
  remove(index) {
    if (index >= 0 && index < this.items.length) {
      this.items.splice(index, 1);
    } else {
      throw new Error('Invalid index for ${baseName}List');
    }
  }
  set(items) {
    if (!Array.isArray(items)) {
      throw new Error('Expected an array for ${baseName}List');
    }
    this.items = items.map(item => {
      if (!(item instanceof ${itemClass})) {
        throw new Error('Expected all items to be instances of ${itemClass}');
      }
      return item;
    });
  }
  toJSON() {
    return this.items.map(item => item.toJSON ? item.toJSON() : item);
  }
}
module.exports = ${baseName}ListModel;
`;
}
/**
 * Gera o código de definição de uma classe de modelo com base nas propriedades fornecidas.
 * Inclui o construtor inicializando todos os campos e o método toJSON() para serialização.
 */
function generateClass(className, properties) {
    const classCode = `
    class ${className} {
      constructor() {
        ${Object.keys(properties).map(prop => {
        var _a, _b;
        const propSchema = properties[prop];
        if (propSchema.type === 'array') {
            // Se propriedade é array, inicializa com array vazio ou ListModel se for multi-tipo
            const concept = (0, utils_1.singularize)(prop).toLowerCase();
            const isMulti = ((_a = multiTypeMap[concept]) === null || _a === void 0 ? void 0 : _a.object) && ((_b = multiTypeMap[concept]) === null || _b === void 0 ? void 0 : _b.array);
            return isMulti
                ? `this.${prop} = new \${capitalize(concept)}ListModel();`
                : `this.${prop} = [];`;
        }
        // Para tipos primitivos ou objetos simples, inicia como null (ou posteriormente instanciado)
        return `this.${prop} = null;`;
    }).join('\n    ')}
      }
      ${generateGettersSetters(properties)}
      toJSON() {
        return {
          ${Object.keys(properties).map(prop => {
        var _a, _b;
        const propSchema = properties[prop];
        if (propSchema.type === 'array') {
            const concept = (0, utils_1.singularize)(prop).toLowerCase();
            const isMulti = ((_a = multiTypeMap[concept]) === null || _a === void 0 ? void 0 : _a.object) && ((_b = multiTypeMap[concept]) === null || _b === void 0 ? void 0 : _b.array);
            if (isMulti) {
                // Para ListModel, chamar toJSON() para obter array
                return `${prop}: this.${prop}.toJSON()`;
            }
            // Array simples: mapear itens chamando toJSON se disponível
            return `${prop}: this.${prop}.map(item => item.toJSON ? item.toJSON() : item)`;
        }
        if (propSchema.type === 'object' && propSchema.properties) {
            // Objeto aninhado: se existir, usar toJSON() se disponível
            return `${prop}: this.${prop} ? (this.${prop}.toJSON ? this.${prop}.toJSON() : this.${prop}) : null`;
        }
        // Tipos primitivos ou outros
        return `${prop}: this.${prop}`;
    }).join(',\n      ')}
        };
      }
    }
    module.exports = ${className};
  `;
    return classCode;
}
/**
 * Gera métodos *getters* e *setters* para as propriedades fornecidas, incluindo tratamento especial para arrays e objetos aninhados.
 */
function generateGettersSetters(properties) {
    return Object.keys(properties).map(prop => {
        var _a, _b, _c;
        const propSchema = properties[prop];
        const propType = propSchema.type;
        if (propType === 'array') {
            // Getter/Setter para arrays (inclui suporte a ListModel multi-tipo)
            const concept = (0, utils_1.singularize)(prop).toLowerCase();
            const conceptClass = (0, utils_1.capitalize)(concept);
            const listClass = `${conceptClass}ListModel`;
            const itemClass = `${conceptClass}Model`;
            const isMulti = ((_a = multiTypeMap[concept]) === null || _a === void 0 ? void 0 : _a.object) && ((_b = multiTypeMap[concept]) === null || _b === void 0 ? void 0 : _b.array);
            if (isMulti) {
                return `
  get${(0, utils_1.capitalize)(prop)}() {
    return this.${prop};
  }
  set${(0, utils_1.capitalize)(prop)}(value) {
    if (value instanceof ${listClass}) {
      this.${prop} = value;
    } else if (Array.isArray(value)) {
      this.${prop} = new ${listClass}(value);
    } else if (value instanceof ${itemClass}) {
      const list = new ${listClass}();
      list.add(value);
      this.${prop} = list;
    } else {
      throw new Error('Expected ${prop} to be an instance of ${listClass}, an array, or an instance of ${itemClass}');
    }
  }
  addTo${(0, utils_1.capitalize)(prop)}(item) {
    if (!(item instanceof ${itemClass})) {
      throw new Error('Expected ${prop} item to be an instance of ${itemClass}');
    }
    this.${prop}.add(item);
  }
  removeFrom${(0, utils_1.capitalize)(prop)}(index) {
    this.${prop}.remove(index);
  }`;
            }
            else {
                // Getter/Setter para array simples
                const itemType = ((_c = propSchema.items) === null || _c === void 0 ? void 0 : _c.type) || 'object';
                // Se o array contém objetos com propriedades definidas, assumimos que há uma classe modelo para o item
                const subClassName = (propSchema.items && propSchema.items.properties)
                    ? `${conceptClass}Model`
                    : conceptClass;
                return `
  get${(0, utils_1.capitalize)(prop)}() {
    return this.${prop};
  }
  addTo${(0, utils_1.capitalize)(prop)}(item) {
    if (typeof item !== '${itemType}' && !(item instanceof ${subClassName})) {
      throw new Error('Expected ${prop} item to be of type ${itemType} or an instance of ${subClassName}');
    }
    this.${prop}.push(item);
  }
  removeFrom${(0, utils_1.capitalize)(prop)}(index) {
    if (index >= 0 && index < this.${prop}.length) {
      this.${prop}.splice(index, 1);
    } else {
      throw new Error('Invalid index for ${prop}');
    }
  }
  set${(0, utils_1.capitalize)(prop)}(items) {
    if (!Array.isArray(items)) {
      throw new Error('Expected an array for ${prop}');
    }
    this.${prop} = items.map(item => {
      if (typeof item !== '${itemType}' && !(item instanceof ${subClassName})) {
        throw new Error('Expected ${prop} item to be of type ${itemType} or an instance of ${subClassName}');
      }
      return item;
    });
  }`;
            }
        }
        if (propType === 'object' && propSchema.properties) {
            // Getter/Setter para objetos aninhados (instancia classe modelo se passado objeto puro)
            const subClassName = `${(0, utils_1.capitalize)(prop)}Model`;
            return `
  get${(0, utils_1.capitalize)(prop)}() {
    return this.${prop} || new ${subClassName}();
  }
  set${(0, utils_1.capitalize)(prop)}(value) {
    if (typeof value === 'object' && !(value instanceof ${subClassName})) {
      const instance = new ${subClassName}();
      Object.assign(instance, value);
      this.${prop} = instance;
    } else if (value instanceof ${subClassName}) {
      this.${prop} = value;
    } else {
      throw new Error('Expected ${prop} to be a plain object or an instance of ${subClassName}');
    }
  }`;
        }
        // Getter/Setter padrão para tipos primitivos (inclui validação básica de tipo)
        const expectedType = propType === 'integer' ? 'number' : propType || 'any';
        const typeCheck = propType === 'integer'
            ? `if (value !== null && !Number.isInteger(value)) {
    throw new Error('Expected ${prop} to be an integer or null');
  }`
            : `if (value !== null && typeof value !== '${expectedType}') {
    throw new Error('Expected ${prop} to be of type ${expectedType} or null');
  }`;
        return `
  get${(0, utils_1.capitalize)(prop)}() {
    return this.${prop};
  }
  set${(0, utils_1.capitalize)(prop)}(value) {
    ${typeCheck}
    this.${prop} = value;
  }`;
    }).join('');
}
/**
 * Gera a classe de modelo para o corpo de requisição de um endpoint/método específico.
 * Cria o arquivo `<ClassName>.js` em `Model/` contendo a definição da classe.
 * Também verifica atributos multi-tipo para eventualmente gerar uma classe de lista correspondente.
 */
function generateRequestBodyClass(className, schema, openApiDoc, generatePathAppDriver) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        if (!schema) {
            console.log(`Nenhum schema encontrado para ${className}!`);
            return;
        }
        const finalSchema = (0, openApiUtils_1.resolveSchemaProperties)(schema, openApiDoc);
        if (!finalSchema.properties) {
            console.log(`Nenhuma propriedade encontrada para ${className}!`);
            return;
        }
        // Garante existência do diretório 'Model'
        const modelDirPath = path_1.default.join(generatePathAppDriver, 'Model');
        if (!fs.existsSync(modelDirPath)) {
            fs.mkdirSync(modelDirPath, { recursive: true });
        }
        // Mescla propriedades existentes (se o arquivo já existir) para preservar histórico de atributos removidos
        const existingPath = path_1.default.join(generatePathAppDriver, 'Model', `${className}.js`);
        const mergedProperties = Object.assign({}, finalSchema.properties);
        if (fs.existsSync(existingPath)) {
            const modelContent = fs.readFileSync(existingPath, 'utf-8');
            const regex = /this\.(\w+)\s?=/g;
            let match;
            const existingProperties = {};
            while ((match = regex.exec(modelContent)) !== null) {
                existingProperties[match[1]] = true;
            }
            for (const prop in existingProperties) {
                if (!mergedProperties[prop]) {
                    // Se havia uma propriedade antiga não mais presente no schema novo, adiciona com tipo genérico (string) para não perder no arquivo
                    mergedProperties[prop] = { type: 'string' };
                }
            }
        }
        // Gera código da classe e formata
        const classCode = generateClass(className, mergedProperties);
        const formattedCode = (0, js_beautify_1.js)(classCode, {
            indent_size: 2,
            space_in_empty_paren: true,
            end_with_newline: true,
        });
        // Escreve o arquivo da classe de modelo
        const filePath = path_1.default.join(generatePathAppDriver, 'Model', `${className}.js`);
        fs.writeFileSync(filePath, formattedCode);
        console.log(`Classe ${className} gerada com sucesso!`);
        // Se o atributo base aparece como objeto e array (multiType), gera classe de lista correspondente
        const baseName = className.endsWith('Model') ? className.slice(0, -5) : className;
        const keyName = baseName.toLowerCase();
        if (((_a = multiTypeMap[keyName]) === null || _a === void 0 ? void 0 : _a.object) && ((_b = multiTypeMap[keyName]) === null || _b === void 0 ? void 0 : _b.array)) {
            const listClassName = `${baseName}ListModel`;
            const listFilePath = path_1.default.join(generatePathAppDriver, 'Model', `${listClassName}.js`);
            if (!fs.existsSync(listFilePath)) {
                const listClassCode = generateListClass(baseName);
                const formattedListCode = (0, js_beautify_1.js)(listClassCode, { indent_size: 2, end_with_newline: true });
                fs.writeFileSync(listFilePath, formattedListCode);
                console.log(`Classe ${listClassName} gerada com sucesso!`);
            }
        }
        // Recursivamente, verifica e gera sub-classes para propriedades internas (objetos aninhados ou itens de array objetos)
        yield verifyRequestBodySubClasses(finalSchema.properties, openApiDoc, generatePathAppDriver);
    });
}
exports.generateRequestBodyClass = generateRequestBodyClass;
/**
 * Verifica propriedades de um schema e gera classes de modelo para objetos ou itens de array internos.
 * Atualiza o multiTypeMap para rastrear tipos e gera classes recursivamente conforme necessário.
 */
function verifyRequestBodySubClasses(properties, openApiDoc, generatePathAppDriver) {
    return __awaiter(this, void 0, void 0, function* () {
        for (const [prop, propSchema] of Object.entries(properties)) {
            if (!propSchema)
                continue;
            const resolved = (0, openApiUtils_1.resolveSchemaProperties)(propSchema, openApiDoc);
            // Nome base singular (ex.: "categories" -> "category")
            const conceptKey = (0, utils_1.singularize)(prop);
            const key = conceptKey.toLowerCase();
            if (!multiTypeMap[key]) {
                multiTypeMap[key] = { object: false, array: false };
            }
            // Marca no mapa se este atributo aparece como objeto e/ou array
            if (resolved.type === 'object') {
                multiTypeMap[key].object = true;
            }
            if (resolved.type === 'array') {
                multiTypeMap[key].array = true;
            }
            // Se for um objeto aninhado, gera uma classe modelo para ele
            if (resolved.type === 'object' && resolved.properties) {
                const subClassName = `${(0, utils_1.capitalize)(conceptKey)}Model`;
                yield generateRequestBodyClass(subClassName, resolved, openApiDoc, generatePathAppDriver);
            }
            // Se for um array de objetos, gera classe modelo para o item do array
            if (resolved.type === 'array' && resolved.items) {
                const arrayItem = (0, openApiUtils_1.resolveSchemaProperties)(resolved.items, openApiDoc);
                if (arrayItem.type === 'object' && arrayItem.properties) {
                    const itemClassName = `${(0, utils_1.capitalize)((0, utils_1.singularize)(prop))}Model`;
                    yield generateRequestBodyClass(itemClassName, arrayItem, openApiDoc, generatePathAppDriver);
                }
            }
        }
    });
}
exports.verifyRequestBodySubClasses = verifyRequestBodySubClasses;
/**
 * Processa todas as classes de request body de um determinado endpoint.
 * Itera sobre cada método (POST/PUT/PATCH) que possua requestBody e gera a respectiva classe de modelo.
 */
function generateRequestBodyClasses(endpointPath, methods, endpointMethods, openApiDoc, generatePathAppDriver) {
    var _a, _b, _c, _d;
    return __awaiter(this, void 0, void 0, function* () {
        for (const method of methods) {
            const opObject = endpointMethods[method];
            if (!opObject || !opObject.requestBody)
                continue;
            const requestBody = opObject.requestBody;
            let schema;
            if (requestBody.$ref) {
                vscode.window.showInformationMessage('generateRequestBodyClasses! requestBody.$ref detectado');
                const resolvedRequestBody = (0, openApiUtils_1.resolveSchemaRef)(requestBody.$ref, openApiDoc);
                schema = (_b = (_a = resolvedRequestBody === null || resolvedRequestBody === void 0 ? void 0 : resolvedRequestBody.content) === null || _a === void 0 ? void 0 : _a['application/json']) === null || _b === void 0 ? void 0 : _b.schema;
            }
            else {
                vscode.window.showInformationMessage('generateRequestBodyClasses! requestBody sem $ref');
                schema = (_d = (_c = requestBody === null || requestBody === void 0 ? void 0 : requestBody.content) === null || _c === void 0 ? void 0 : _c['application/json']) === null || _d === void 0 ? void 0 : _d.schema;
            }
            if (!schema) {
                vscode.window.showWarningMessage(`generateRequestBodyClasses: schema indefinido para ${endpointPath} ${method}`);
                continue;
            }
            // Gera nome da classe de modelo (usa nome do schema referenciado, ou constrói a partir do path e método)
            let baseName;
            if (schema.$ref) {
                baseName = (0, openApiUtils_1.resolveRef)(schema.$ref, openApiDoc);
            }
            else {
                const sanitizedPath = (0, utils_1.capitalize)(endpointPath.replace(/\W+/g, '_'));
                baseName = `${sanitizedPath}${(0, utils_1.capitalize)(method)}`;
            }
            const className = `${baseName}Model`;
            // Gera a classe de modelo para este request body
            yield generateRequestBodyClass(className, schema, openApiDoc, generatePathAppDriver);
        }
    });
}
exports.generateRequestBodyClasses = generateRequestBodyClasses;
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
