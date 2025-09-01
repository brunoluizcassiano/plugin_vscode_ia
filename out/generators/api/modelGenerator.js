"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateClass = void 0;
const utils_1 = require("../utils/utils");
let generatedClassNames = new Set();
function generateUniqueClassName(base) {
    let name = (0, utils_1.capitalize)(base) + 'Model';
    let i = 1;
    while (generatedClassNames.has(name)) {
        name = (0, utils_1.capitalize)(base) + i + 'Model';
        i++;
    }
    generatedClassNames.add(name);
    return name;
}
function generateClass(className, schema) {
    generatedClassNames = new Set([className]);
    const result = {};
    function buildClassCode(currentName, props) {
        const constructorLines = Object.keys(props).sort().map((prop) => {
            const value = props[prop];
            if ((value === null || value === void 0 ? void 0 : value.type) === 'array')
                return `this.${prop} = [];`;
            return `this.${prop} = null;`;
        });
        const gettersSetters = Object.keys(props).sort().map((prop) => {
            const propSchema = props[prop];
            const propType = (propSchema === null || propSchema === void 0 ? void 0 : propSchema.type) || 'any';
            const expectedType = propType === 'integer' ? 'number' : propType;
            if (propType === 'array') {
                const concept = (0, utils_1.singularize)(prop).toLowerCase();
                const conceptClass = (0, utils_1.capitalize)(concept);
                const itemClass = conceptClass + 'Model';
                return `
get${(0, utils_1.capitalize)(prop)}() {
 return this.${prop};
}
addTo${(0, utils_1.capitalize)(prop)}(item) {
 if (typeof item !== 'object' && !(item instanceof ${itemClass})) {
   throw new Error('Expected ${prop} item to be an object or instance of ${itemClass}');
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
   if (typeof item !== 'object' && !(item instanceof ${itemClass})) {
     throw new Error('Expected ${prop} item to be an object or instance of ${itemClass}');
   }
   return item;
 });
}`;
            }
            if (propType === 'object') {
                const classRef = (0, utils_1.capitalize)(prop) + 'Model';
                return `
get${(0, utils_1.capitalize)(prop)}() {
 return this.${prop};
}
set${(0, utils_1.capitalize)(prop)}(value) {
 if (typeof value === 'object' && !(value instanceof ${classRef})) {
   const instance = new ${classRef}();
   Object.assign(instance, value);
   this.${prop} = instance;
 } else if (value instanceof ${classRef}) {
   this.${prop} = value;
 } else {
   throw new Error('Expected ${prop} to be a plain object or instance of ${classRef}');
 }
}`;
            }
            const typeCheck = propType === 'integer'
                ? `if (value !== null && !Number.isInteger(value)) throw new Error('Expected ${prop} to be an integer or null');`
                : `if (value !== null && typeof value !== '${expectedType}') throw new Error('Expected ${prop} to be of type ${expectedType} or null');`;
            return `
get${(0, utils_1.capitalize)(prop)}() {
 return this.${prop};
}
set${(0, utils_1.capitalize)(prop)}(value) {
 ${typeCheck}
 this.${prop} = value;
}`;
        });
        const toJSONLines = Object.keys(props).sort().map((prop) => `${prop}: this.${prop}`);
        return `
class ${currentName} {
 constructor() {
   ${constructorLines.join('\n    ')}
 }
 ${gettersSetters.join('\n  ')}
 toJSON() {
   return {
     ${toJSONLines.join(',\n      ')}
   };
 }
}
module.exports = ${currentName};
`.trim();
    }
    function traverse(name, body) {
        const innerClasses = {};
        function inferProperties(obj) {
            const properties = {};
            for (const key of Object.keys(obj).sort()) {
                const value = obj[key];
                if (Array.isArray(value)) {
                    if (value.length > 0 && typeof value[0] === 'object') {
                        const innerName = generateUniqueClassName(key);
                        innerClasses[`${innerName}.js`] = buildClassCode(innerName, inferProperties(value[0]));
                    }
                    properties[key] = { type: 'array' };
                }
                else if (value && typeof value === 'object') {
                    const innerName = generateUniqueClassName(key);
                    innerClasses[`${innerName}.js`] = buildClassCode(innerName, inferProperties(value));
                    properties[key] = { type: 'object' };
                }
                else {
                    const valueType = typeof value === 'number' && Number.isInteger(value)
                        ? 'integer'
                        : typeof value;
                    properties[key] = { type: value === null ? 'any' : valueType };
                }
            }
            return properties;
        }
        const inferred = inferProperties(body);
        const classNameWithSuffix = className.endsWith('Model') ? className : className + 'Model';
        const mainCode = buildClassCode(classNameWithSuffix, inferred);
        return { main: mainCode, inner: innerClasses };
    }
    const { main, inner } = traverse(className, schema);
    const classFileName = className.endsWith('Model') ? className : className + 'Model';
    result[`${classFileName}.js`] = main;
    Object.assign(result, inner);
    return result;
}
exports.generateClass = generateClass;
// import { capitalize, singularize } from '../utils/utils';
// let generatedClassNames = new Set<string>();
// function generateUniqueClassName(base: string): string {
//   let name = capitalize(base);
//   let i = 1;
//   while (generatedClassNames.has(name)) {
//     name = capitalize(base) + i;
//     i++;
//   }
//   generatedClassNames.add(name);
//   return name;
// }
// export function generateClass(
//   className: string,
//   schema: Record<string, any>
// ): { [fileName: string]: string } {
//   generatedClassNames = new Set([className]);
//   const result: { [fileName: string]: string } = {};
//   function buildClassCode(currentName: string, body: Record<string, any>): string {
//     const props = Object.keys(body).sort().map((prop) => {
//       const value = body[prop];
//       if (Array.isArray(value)) return `this.${prop} = [];`;
//       if (value === null) return `this.${prop} = null;`;
//       if (typeof value === "object") return `this.${prop} = {};`;
//       return `this.${prop} = null;`;
//     });
//     const settersGetters = generateGettersSetters(body);
//     const toJSON = Object.keys(body).sort().map((prop) => `  ${prop}: this.${prop}`).join(",\n");
//     return `
// class ${currentName} {
//  constructor() {
//    ${props.join("\n    ")}
//  }
//  ${settersGetters}
//  toJSON() {
//    return {
//      ${toJSON}
//    };
//  }
// }
// module.exports = ${currentName};
// `.trim();
//   }
//   function traverse(name: string, body: any): { main: string; inner: Record<string, string> } {
//     const innerClasses: Record<string, string> = {};
//     function inferProperties(obj: any): any {
//       const properties: Record<string, any> = {};
//       for (const key of Object.keys(obj).sort()) {
//         const value = obj[key];
//         if (Array.isArray(value)) {
//           if (value.length > 0 && typeof value[0] === "object") {
//             const innerName = generateUniqueClassName(key);
//             innerClasses[`${innerName}.js`] = buildClassCode(innerName, inferProperties(value[0]));
//             properties[key] = {
//               type: "array",
//               items: {
//                 type: "object",
//                 properties: value[0]
//               }
//             };
//           } else {
//             properties[key] = { type: "array", items: { type: typeof value[0] || "any" } };
//           }
//         } else if (value && typeof value === "object") {
//           const innerName = generateUniqueClassName(key);
//           innerClasses[`${innerName}.js`] = buildClassCode(innerName, inferProperties(value));
//           properties[key] = { type: "object", properties: value };
//         } else {
//           properties[key] = { type: typeof value };
//         }
//       }
//       return properties;
//     }
//     const inferred = inferProperties(body);
//     const mainCode = buildClassCode(name, inferred);
//     return { main: mainCode, inner: innerClasses };
//   }
//   const { main, inner } = traverse(className, schema);
//   result[`${className}.js`] = main;
//   Object.assign(result, inner);
//   return result;
// }
// // --- Getters & Setters com validação de tipo ---
// function generateGettersSetters(properties: Record<string, any>): string {
//   return Object.keys(properties).map((prop) => {
//     const propSchema = properties[prop];
//     const propType = propSchema?.type;
//     const propName = capitalize(prop);
//     if (propType === 'array') {
//       const concept = singularize(prop).toLowerCase();
//       const conceptClass = capitalize(concept);
//       const itemType = propSchema.items?.type || 'object';
//       const subClassName = (propSchema.items && propSchema.items.properties)
//         ? `${conceptClass}Model`
//         : conceptClass;
//       return `
//  get${propName}() {
//    return this.${prop};
//  }
//  addTo${propName}(item) {
//    if (typeof item !== '${itemType}' && !(item instanceof ${subClassName})) {
//      throw new Error('Expected ${prop} item to be of type ${itemType} or an instance of ${subClassName}');
//    }
//    this.${prop}.push(item);
//  }
//  removeFrom${propName}(index) {
//    if (index >= 0 && index < this.${prop}.length) {
//      this.${prop}.splice(index, 1);
//    } else {
//      throw new Error('Invalid index for ${prop}');
//    }
//  }
//  set${propName}(items) {
//    if (!Array.isArray(items)) {
//      throw new Error('Expected an array for ${prop}');
//    }
//    this.${prop} = items.map(item => {
//      if (typeof item !== '${itemType}' && !(item instanceof ${subClassName})) {
//        throw new Error('Expected ${prop} item to be of type ${itemType} or an instance of ${subClassName}');
//      }
//      return item;
//    });
//  }`;
//     }
//     if (propType === 'object' && propSchema.properties) {
//       const subClassName = `${capitalize(prop)}Model`;
//       return `
//  get${propName}() {
//    return this.${prop} || new ${subClassName}();
//  }
//  set${propName}(value) {
//    if (typeof value === 'object' && !(value instanceof ${subClassName})) {
//      const instance = new ${subClassName}();
//      Object.assign(instance, value);
//      this.${prop} = instance;
//    } else if (value instanceof ${subClassName}) {
//      this.${prop} = value;
//    } else {
//      throw new Error('Expected ${prop} to be a plain object or an instance of ${subClassName}');
//    }
//  }`;
//     }
//     const expectedType = propType === 'integer' ? 'number' : propType || 'any';
//     const typeCheck = propType === 'integer'
//       ? `if (value !== null && !Number.isInteger(value)) throw new Error('Expected ${prop} to be an integer or null');`
//       : `if (value !== null && typeof value !== '${expectedType}') throw new Error('Expected ${prop} to be of type ${expectedType} or null');`;
//     return `
//  get${propName}() {
//    return this.${prop};
//  }
//  set${propName}(value) {
//    ${typeCheck}
//    this.${prop} = value;
//  }`;
//   }).join('\n  ');
// }
