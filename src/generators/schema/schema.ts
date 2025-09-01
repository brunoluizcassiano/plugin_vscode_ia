import * as vscode from 'vscode';
import * as fs from 'fs';
import { promises as fsp } from 'fs';
import * as path from 'path';
import { js as beautify } from 'js-beautify';

const processedSchemas: Set<string> = new Set();

interface OpenAPISchema {
  $ref?: string;
  type?: string;
  properties?: Record<string, any>;
  required?: string[];
  [key: string]: any;
}

class SchemaContext {
  private static filePath: string;
  private static document: any;

  constructor(filePath: string) {
    if (!filePath) throw new Error('filePath is required');
    SchemaContext.filePath = filePath;
    SchemaContext.document = null;
  }

  static setFilePath(filePath: string) {
    SchemaContext.filePath = filePath;
  }

  static getFilePath(): string {
    return SchemaContext.filePath;
  }

  static setDocument(document: any) {
    SchemaContext.document = document;
  }

  static getDocument(): any {
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
    if (!mod?.load) throw new Error('js-yaml sem método load');
    return mod.load as (src: string) => any;
  } catch (e: any) {
    throw new Error(`js-yaml não encontrado no runtime: ${e?.message || e}`);
  }
}

/**
 * Resolve a última parte de um $ref (ex.: "#/components/schemas/User" -> "User")
 */
const resolveRef = (ref: string): string => {
  const refParts = ref.split('/');
  return refParts[refParts.length - 1];
};

/**
 * Processa schema recursivamente para retirar ruído e coletar subSchemas ($ref)
 */
const processSchema = (schema: any, subSchemas: string[]): any => {
  if (schema?.$ref) {
    const schemaName = resolveRef(schema.$ref);
    subSchemas.push(schemaName);
    return { $ref: schemaName };
  }

  if (typeof schema === 'object' && schema !== null) {
    const filteredSchema: any = {};
    for (const key in schema) {
      if (key === 'type' && schema[key] !== 'enum') {
        filteredSchema[key] = schema[key];
      } else if (typeof schema[key] === 'object') {
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

const getProperties = (processedSchema: OpenAPISchema, requiredFields: string[]): string => {
  if (!processedSchema.properties || Object.keys(processedSchema.properties).length === 0) {
    delete processedSchema.properties;
    return '';
  }
  const updatedProperties: any = {};
  for (const field of Object.keys(processedSchema.properties)) {
    const fieldSchema = (processedSchema.properties as any)[field];
    if (!requiredFields.includes(field) && fieldSchema?.type) {
      fieldSchema.nullable = true;
    }
    updatedProperties[field] = fieldSchema;
  }
  return `properties: ${JSON.stringify(updatedProperties, null, 4)},`;
};

const getRequired = (schema: OpenAPISchema): string => {
  if (!schema.required || schema.required.length === 0) {
    delete schema.required;
    return '';
  }
  return `"required": ${JSON.stringify(schema.required)}`;
};

const requiredSubSchema = (directSubSchemas: string[]): string => {
  const uniqueSubSchemas = Array.from(new Set(directSubSchemas));
  if (uniqueSubSchemas.length === 0) return '';
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
export async function loadDocumentation(filePath: string): Promise<any | undefined> {
  SchemaContext.setFilePath(filePath);
  try {
    if (!SchemaContext.getFilePath()) {
      vscode.window.showErrorMessage('Nenhum arquivo OpenAPI informado.');
      return undefined;
    }

    const stat = await fsp.stat(SchemaContext.getFilePath());
    if (!stat.isFile()) {
      vscode.window.showErrorMessage('O caminho selecionado não é um arquivo.');
      return undefined;
    }

    const raw = await fsp.readFile(SchemaContext.getFilePath(), 'utf8');

    // Remove BOM (Byte Order Mark), muito comum em arquivos corporativos
    const fileContents = raw.replace(/^\uFEFF/, '');

    // Heurística: se começa com { ou [, tende a ser JSON
    const looksLikeJson = /^\s*[\{\[]/.test(fileContents);

    let parsed: any;
    try {
      parsed = looksLikeJson ? JSON.parse(fileContents) : loadYamlModule()(fileContents);
    } catch (_e1) {
      // Fallback para o outro parser
      try {
        parsed = looksLikeJson ? loadYamlModule()(fileContents) : JSON.parse(fileContents);
      } catch (e2: any) {
        vscode.window.showErrorMessage(`Erro ao parsear OpenAPI: ${e2?.message || String(e2)}`);
        return undefined;
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      vscode.window.showErrorMessage('Documento OpenAPI inválido (parser retornou valor não-objeto).');
      return undefined;
    }

    SchemaContext.setDocument(parsed);
    return SchemaContext.getDocument();
  } catch (error: any) {
    vscode.window.showErrorMessage(`Error reading OpenAPI file: ${error?.message || String(error)}`);
    return undefined;
  }
}

export async function unloadDocumentation(): Promise<void> {
  try {
    SchemaContext.setFilePath('');
    SchemaContext.setDocument(undefined);
    processedSchemas.clear();
  } catch (error: any) {
    vscode.window.showErrorMessage(`Erro ao limpar o contexto do OpenAPI: ${error?.message || String(error)}`);
  }
}

export async function listEndpoints(): Promise<string[]> {
  const document = SchemaContext.getDocument();
  if (!document || !document.paths) {
    vscode.window.showWarningMessage('Documento OpenAPI não carregado ou inválido.');
    return [];
  }
  return Object.keys(document.paths);
}

export async function listEndpointsWithMethods(): Promise<{ path: string; methods: string[] }[]> {
  const document = SchemaContext.getDocument();
  if (!document?.paths) return [];
  return Object.entries(document.paths).map(([p, methods]) => ({
    path: p,
    methods: Object.keys(methods as Record<string, any>),
  }));
}

export async function getPaths(): Promise<any> {
  const document = SchemaContext.getDocument();
  if (!document?.paths) throw new Error('OpenAPI document is not loaded or invalid');
  return document.paths;
}

export async function getSchemasForResponse(pathKey: string, method: string): Promise<any> {
  const responses = SchemaContext.getDocument().paths[pathKey][method].responses;
  const schemas: any = {};
  for (const [statusCode, response] of Object.entries(responses)) {
    if ((response as any).content?.['application/json']) {
      schemas[statusCode] = (response as any).content['application/json'].schema;
    }
  }
  return schemas;
}

export async function getRequestBodySchema(pathKey: string, method: string): Promise<any> {
  const requestBody = SchemaContext.getDocument().paths[pathKey][method].requestBody;
  if (requestBody?.content?.['application/json']) {
    return requestBody.content['application/json'].schema;
  }
  return null;
}

export async function generateFromOpenAPI(filePath: string, endpoint?: string): Promise<string> {
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
          const responseSchema = responses[statusCode].content?.['application/json']?.schema;
          if (responseSchema?.items?.$ref) {
            const schemaName = resolveRef(responseSchema.items.$ref);
            await generateClass(filePath, schemaName, document.components.schemas[schemaName], document);
          }
        }
      }
    } else {
      throw new Error(`Endpoint ${endpoint} not found in OpenAPI document.`);
    }
  } else {
    const schemas = document.components?.schemas || {};
    for (const schemaName in schemas) {
      await generateClass(filePath, schemaName, schemas[schemaName], document);
    }
  }
  return 'generateFromOpenAPI()';
}

async function generateClass(
  filePath: string,
  className: string,
  schema: OpenAPISchema,
  document: any
): Promise<void> {
  if (processedSchemas.has(className)) return;
  processedSchemas.add(className);

  const directSubSchemas: string[] = [];
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

  const formattedCode = beautify(classCode, {
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
  } catch (err) {
    console.error('Error writing file:', err);
  }

  for (const subSchema of directSubSchemas) {
    if (document.components?.schemas?.[subSchema]) {
      await generateClass(filePath, subSchema, document.components.schemas[subSchema], document);
    }
  }
}
