"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSchemaProperties = exports.resolveSchema = exports.resolveRef = exports.resolveSchemaRef = void 0;
/**
* Resolve um caminho $ref dentro do documento OpenAPI e retorna o schema alvo.
* @param ref Caminho de referência (ex: "#/components/schemas/Pet")
* @param openApiDoc Documento OpenAPI completo já carregado
*/
function resolveSchemaRef(ref, openApiDoc) {
    const refPath = ref.replace('#/', '').split('/');
    let schema = openApiDoc;
    for (const segment of refPath) {
        schema = schema[segment];
    }
    return schema;
}
exports.resolveSchemaRef = resolveSchemaRef;
/**
* Extrai apenas o nome final de um caminho $ref.
* Ex: "#/components/schemas/Pet" -> "Pet"
*/
function resolveRef(ref, openApiDoc) {
    if (!ref || typeof ref !== 'string') {
        return 'Unknown'; // nome padrão caso não haja ref
    }
    const refParts = ref.split('/');
    return refParts[refParts.length - 1];
}
exports.resolveRef = resolveRef;
/**
* Se o schema for uma referência ($ref), retorna o schema real que está sendo referenciado.
* Caso contrário, retorna o próprio schema.
*/
function resolveSchema(schema, openApiDoc) {
    if (schema.$ref) {
        const refPath = schema.$ref.replace('#/', '').split('/');
        return refPath.reduce((acc, part) => acc[part], openApiDoc);
    }
    return schema;
}
exports.resolveSchema = resolveSchema;
/**
* Resolve recursivamente todas as referências e exemplos dentro de um schema.
* - Substitui $ref pelo objeto real dentro de openApiDoc.
* - Se encontrar propriedades do tipo object com campo example, converte os exemplos em propriedades do schema.
* - Também resolve itens de arrays recursivamente.
*/
function resolveSchemaProperties(schema, openApiDoc) {
    // Se for referência, incorpora o schema referenciado
    if (schema.$ref) {
        const refSchema = resolveSchemaRef(schema.$ref, openApiDoc);
        schema = Object.assign(Object.assign({}, schema), refSchema);
        delete schema.$ref;
    }
    // Resolver propriedades do objeto, se houver
    if (schema.properties) {
        for (const prop of Object.keys(schema.properties)) {
            const propSchema = schema.properties[prop];
            if (propSchema.$ref) {
                // Resolve referência dentro da propriedade
                schema.properties[prop] = resolveSchemaProperties(propSchema, openApiDoc);
            }
            // Se a propriedade é um objeto declarado inline com um exemplo mas sem definir sub-propriedades,
            // usamos o exemplo para inferir as propriedades e seus tipos.
            if (propSchema.type === 'object' && propSchema.example && !propSchema.properties) {
                schema.properties[prop].properties = {};
                Object.keys(propSchema.example).forEach(exampleKey => {
                    schema.properties[prop].properties[exampleKey] = {
                        type: typeof propSchema.example[exampleKey],
                        example: propSchema.example[exampleKey],
                    };
                });
            }
        }
    }
    // Se for um array, resolver o schema dos itens (incluindo $ref ou objetos inline)
    if (schema.type === 'array' && schema.items) {
        schema.items = resolveSchemaProperties(schema.items, openApiDoc);
    }
    return schema;
}
exports.resolveSchemaProperties = resolveSchemaProperties;
