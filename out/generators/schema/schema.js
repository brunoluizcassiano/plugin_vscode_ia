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
exports.generateFromOpenAPI = exports.getRequestBodySchema = exports.getSchemasForResponse = exports.getPaths = exports.listEndpointsWithMethods = exports.listEndpoints = exports.unloadDocumentation = exports.loadDocumentation = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const fs_1 = require("fs");
const path = __importStar(require("path"));
const js_beautify_1 = require("js-beautify");
const processedSchemas = new Set();
class SchemaContext {
    constructor(filePath) {
        if (!filePath)
            throw new Error('filePath is required');
        SchemaContext.filePath = filePath;
        SchemaContext.document = null;
    }
    static setFilePath(filePath) {
        SchemaContext.filePath = filePath;
    }
    static getFilePath() {
        return SchemaContext.filePath;
    }
    static setDocument(document) {
        SchemaContext.document = document;
    }
    static getDocument() {
        return SchemaContext.document;
    }
}
/**
 * Carrega js-yaml de forma lazy via require (robusto no runtime do VS Code).
 */
function loadYamlModule() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require('js-yaml');
        if (!(mod === null || mod === void 0 ? void 0 : mod.load))
            throw new Error('js-yaml sem método load');
        return mod.load;
    }
    catch (e) {
        throw new Error(`js-yaml não encontrado no runtime: ${(e === null || e === void 0 ? void 0 : e.message) || e}`);
    }
}
/**
 * Resolve a última parte de um $ref (ex.: "#/components/schemas/User" -> "User")
 */
const resolveRef = (ref) => {
    const refParts = ref.split('/');
    return refParts[refParts.length - 1];
};
/**
 * Processa schema recursivamente para retirar ruído e coletar subSchemas ($ref)
 */
const processSchema = (schema, subSchemas) => {
    if (schema === null || schema === void 0 ? void 0 : schema.$ref) {
        const schemaName = resolveRef(schema.$ref);
        subSchemas.push(schemaName);
        return { $ref: schemaName };
    }
    if (typeof schema === 'object' && schema !== null) {
        const filteredSchema = {};
        for (const key in schema) {
            if (key === 'type' && schema[key] !== 'enum') {
                filteredSchema[key] = schema[key];
            }
            else if (typeof schema[key] === 'object') {
                const processed = processSchema(schema[key], subSchemas);
                if (processed && Object.keys(processed).length > 0) {
                    filteredSchema[key] = processed;
                }
            }
        }
        return filteredSchema;
    }
    return schema;
};
const getProperties = (processedSchema, requiredFields) => {
    if (!processedSchema.properties || Object.keys(processedSchema.properties).length === 0) {
        delete processedSchema.properties;
        return '';
    }
    const updatedProperties = {};
    for (const field of Object.keys(processedSchema.properties)) {
        const fieldSchema = processedSchema.properties[field];
        if (!requiredFields.includes(field) && (fieldSchema === null || fieldSchema === void 0 ? void 0 : fieldSchema.type)) {
            fieldSchema.nullable = true;
        }
        updatedProperties[field] = fieldSchema;
    }
    return `properties: ${JSON.stringify(updatedProperties, null, 4)},`;
};
const getRequired = (schema) => {
    if (!schema.required || schema.required.length === 0) {
        delete schema.required;
        return '';
    }
    return `"required": ${JSON.stringify(schema.required)}`;
};
const requiredSubSchema = (directSubSchemas) => {
    const uniqueSubSchemas = Array.from(new Set(directSubSchemas));
    if (uniqueSubSchemas.length === 0)
        return '';
    let subSchemaName = `\nconst schemas = {\n`;
    for (const name of uniqueSubSchemas) {
        subSchemaName += `  ${name}: require('./${name}.js'),\n`;
    }
    subSchemaName += `};\n`;
    return subSchemaName;
};
/**
 * Carrega e parseia o arquivo OpenAPI (JSON ou YAML). Salva em SchemaContext.
 * Robusto contra BOM e com fallback JSON↔YAML.
 */
function loadDocumentation(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        SchemaContext.setFilePath(filePath);
        try {
            if (!SchemaContext.getFilePath()) {
                vscode.window.showErrorMessage('Nenhum arquivo OpenAPI informado.');
                return undefined;
            }
            const stat = yield fs_1.promises.stat(SchemaContext.getFilePath());
            if (!stat.isFile()) {
                vscode.window.showErrorMessage('O caminho selecionado não é um arquivo.');
                return undefined;
            }
            const raw = yield fs_1.promises.readFile(SchemaContext.getFilePath(), 'utf8');
            // Remove BOM (Byte Order Mark), muito comum em arquivos corporativos
            const fileContents = raw.replace(/^\uFEFF/, '');
            // Heurística: se começa com { ou [, tende a ser JSON
            const looksLikeJson = /^\s*[\{\[]/.test(fileContents);
            let parsed;
            try {
                parsed = looksLikeJson ? JSON.parse(fileContents) : loadYamlModule()(fileContents);
            }
            catch (_e1) {
                // Fallback para o outro parser
                try {
                    parsed = looksLikeJson ? loadYamlModule()(fileContents) : JSON.parse(fileContents);
                }
                catch (e2) {
                    vscode.window.showErrorMessage(`Erro ao parsear OpenAPI: ${(e2 === null || e2 === void 0 ? void 0 : e2.message) || String(e2)}`);
                    return undefined;
                }
            }
            if (!parsed || typeof parsed !== 'object') {
                vscode.window.showErrorMessage('Documento OpenAPI inválido (parser retornou valor não-objeto).');
                return undefined;
            }
            SchemaContext.setDocument(parsed);
            return SchemaContext.getDocument();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error reading OpenAPI file: ${(error === null || error === void 0 ? void 0 : error.message) || String(error)}`);
            return undefined;
        }
    });
}
exports.loadDocumentation = loadDocumentation;
function unloadDocumentation() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            SchemaContext.setFilePath('');
            SchemaContext.setDocument(undefined);
            processedSchemas.clear();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Erro ao limpar o contexto do OpenAPI: ${(error === null || error === void 0 ? void 0 : error.message) || String(error)}`);
        }
    });
}
exports.unloadDocumentation = unloadDocumentation;
function listEndpoints() {
    return __awaiter(this, void 0, void 0, function* () {
        const document = SchemaContext.getDocument();
        if (!document || !document.paths) {
            vscode.window.showWarningMessage('Documento OpenAPI não carregado ou inválido.');
            return [];
        }
        return Object.keys(document.paths);
    });
}
exports.listEndpoints = listEndpoints;
function listEndpointsWithMethods() {
    return __awaiter(this, void 0, void 0, function* () {
        const document = SchemaContext.getDocument();
        if (!(document === null || document === void 0 ? void 0 : document.paths))
            return [];
        return Object.entries(document.paths).map(([p, methods]) => ({
            path: p,
            methods: Object.keys(methods),
        }));
    });
}
exports.listEndpointsWithMethods = listEndpointsWithMethods;
function getPaths() {
    return __awaiter(this, void 0, void 0, function* () {
        const document = SchemaContext.getDocument();
        if (!(document === null || document === void 0 ? void 0 : document.paths))
            throw new Error('OpenAPI document is not loaded or invalid');
        return document.paths;
    });
}
exports.getPaths = getPaths;
function getSchemasForResponse(pathKey, method) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const responses = SchemaContext.getDocument().paths[pathKey][method].responses;
        const schemas = {};
        for (const [statusCode, response] of Object.entries(responses)) {
            if ((_a = response.content) === null || _a === void 0 ? void 0 : _a['application/json']) {
                schemas[statusCode] = response.content['application/json'].schema;
            }
        }
        return schemas;
    });
}
exports.getSchemasForResponse = getSchemasForResponse;
function getRequestBodySchema(pathKey, method) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const requestBody = SchemaContext.getDocument().paths[pathKey][method].requestBody;
        if ((_a = requestBody === null || requestBody === void 0 ? void 0 : requestBody.content) === null || _a === void 0 ? void 0 : _a['application/json']) {
            return requestBody.content['application/json'].schema;
        }
        return null;
    });
}
exports.getRequestBodySchema = getRequestBodySchema;
function generateFromOpenAPI(filePath, endpoint) {
    var _a, _b, _c, _d;
    return __awaiter(this, void 0, void 0, function* () {
        vscode.window.showInformationMessage(`OpenAPI file: ${filePath}`);
        const document = SchemaContext.getDocument();
        const paths = document.paths;
        if (endpoint) {
            if (paths[endpoint]) {
                const endpointData = paths[endpoint];
                for (const method of Object.keys(endpointData)) {
                    const operation = endpointData[method];
                    const responses = operation.responses;
                    for (const statusCode in responses) {
                        const responseSchema = (_b = (_a = responses[statusCode].content) === null || _a === void 0 ? void 0 : _a['application/json']) === null || _b === void 0 ? void 0 : _b.schema;
                        if ((_c = responseSchema === null || responseSchema === void 0 ? void 0 : responseSchema.items) === null || _c === void 0 ? void 0 : _c.$ref) {
                            const schemaName = resolveRef(responseSchema.items.$ref);
                            yield generateClass(filePath, schemaName, document.components.schemas[schemaName], document);
                        }
                    }
                }
            }
            else {
                throw new Error(`Endpoint ${endpoint} not found in OpenAPI document.`);
            }
        }
        else {
            const schemas = ((_d = document.components) === null || _d === void 0 ? void 0 : _d.schemas) || {};
            for (const schemaName in schemas) {
                yield generateClass(filePath, schemaName, schemas[schemaName], document);
            }
        }
        return 'generateFromOpenAPI()';
    });
}
exports.generateFromOpenAPI = generateFromOpenAPI;
function generateClass(filePath, className, schema, document) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        if (processedSchemas.has(className))
            return;
        processedSchemas.add(className);
        const directSubSchemas = [];
        const processedSchema = processSchema(schema, directSubSchemas);
        const classCode = `
const SchemaWrapper = require('@cypress-pattern-globalcards/SchemaWrapper');
${requiredSubSchema(directSubSchemas)}
class ${className} extends SchemaWrapper {
  getSchema() {
    return {
      "$id": "${className}",
      "type": "${schema.type}",
      ${getProperties(processedSchema, schema.required || [])}
      ${getRequired(schema)}
    };
  }

  getSubSchemas() {
    const directSubSchemas = ${JSON.stringify(directSubSchemas)};
    const subSchemas = directSubSchemas.map((subSchema) => {
      const subSchemaType = schemas[subSchema];
      const subSchemaInstance = new subSchemaType();
      return subSchemaInstance.getSubSchemas();
    });
    return directSubSchemas.concat(subSchemas.flat());
  }
}
module.exports = ${className};
`;
        const formattedCode = (0, js_beautify_1.js)(classCode, {
            indent_size: 2,
            space_in_empty_paren: true,
            end_with_newline: true,
        });
        const schemasDirPath = path.join(filePath, 'schemas');
        if (!fs.existsSync(schemasDirPath)) {
            fs.mkdirSync(schemasDirPath, { recursive: true });
        }
        try {
            fs.writeFileSync(path.join(schemasDirPath, `${className}.js`), formattedCode);
            console.log(`Class ${className}.js generated successfully!`);
        }
        catch (err) {
            console.error('Error writing file:', err);
        }
        for (const subSchema of directSubSchemas) {
            if ((_b = (_a = document.components) === null || _a === void 0 ? void 0 : _a.schemas) === null || _b === void 0 ? void 0 : _b[subSchema]) {
                yield generateClass(filePath, subSchema, document.components.schemas[subSchema], document);
            }
        }
    });
}
