// openApiUtils.ts - Funções para resolver referências e schemas OpenAPI
import { yaml } from './utils';
/**
* Resolve um caminho $ref dentro do documento OpenAPI e retorna o schema alvo.
* @param ref Caminho de referência (ex: "#/components/schemas/Pet")
* @param openApiDoc Documento OpenAPI completo já carregado
*/
export function resolveSchemaRef(ref: string, openApiDoc: any): any {
 const refPath = ref.replace('#/', '').split('/');
 let schema: any = openApiDoc;
 for (const segment of refPath) {
   schema = schema[segment];
 }
 return schema;
}
/**
* Extrai apenas o nome final de um caminho $ref.
* Ex: "#/components/schemas/Pet" -> "Pet"
*/
export function resolveRef(ref: string | undefined, openApiDoc?: any): string {
 if (!ref || typeof ref !== 'string') {
   return 'Unknown'; // nome padrão caso não haja ref
 }
 const refParts = ref.split('/');
 return refParts[refParts.length - 1];
}
/**
* Se o schema for uma referência ($ref), retorna o schema real que está sendo referenciado.
* Caso contrário, retorna o próprio schema.
*/
export function resolveSchema(schema: any, openApiDoc: any): any {
 if (schema.$ref) {
   const refPath = schema.$ref.replace('#/', '').split('/');
   return refPath.reduce((acc: any, part: string) => acc[part], openApiDoc);
 }
 return schema;
}
/**
* Resolve recursivamente todas as referências e exemplos dentro de um schema.
* - Substitui $ref pelo objeto real dentro de openApiDoc.
* - Se encontrar propriedades do tipo object com campo example, converte os exemplos em propriedades do schema.
* - Também resolve itens de arrays recursivamente.
*/
export function resolveSchemaProperties(schema: any, openApiDoc: any): any {
 // Se for referência, incorpora o schema referenciado
 if (schema.$ref) {
   const refSchema = resolveSchemaRef(schema.$ref, openApiDoc);
   schema = { ...schema, ...refSchema };
   delete schema.$ref;
 }
 // Resolver propriedades do objeto, se houver
 if (schema.properties) {
   for (const prop of Object.keys(schema.properties)) {
     const propSchema: any = schema.properties[prop];
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
