"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCurl = void 0;
function parseCurl(curl) {
    const lines = curl.split('\\\n').map(line => line.trim()).filter(Boolean);
    const result = {
        method: 'GET',
        url: '',
        path: '',
        headers: {},
    };
    for (const line of lines) {
        // Detecta método dentro da linha do curl (ex: curl --request POST ...)
        if (line.startsWith('curl')) {
            const methodMatch = line.match(/--request\s+(\w+)/i);
            if (methodMatch) {
                result.method = methodMatch[1].toUpperCase();
            }
            const urlMatch = line.match(/['"]?(https?:\/\/[^\s'"]+)['"]?/);
            if (urlMatch) {
                result.url = urlMatch[1];
                try {
                    const parsedUrl = new URL(result.url);
                    result.path = parsedUrl.pathname;
                }
                catch (_a) {
                    result.path = '';
                }
            }
        }
        // Alternativa: método fora da linha do curl
        else if (line.startsWith('-X') || line.startsWith('--request')) {
            const match = line.match(/(?:-X|--request)\s+(\w+)/i);
            if (match)
                result.method = match[1].toUpperCase();
        }
        // Cabeçalhos
        else if (line.startsWith('-H') || line.startsWith('--header')) {
            const header = line.match(/['"]?(.+?):\s*(.+?)['"]?$/);
            if (header)
                result.headers[header[1]] = header[2];
        }
        // Corpo (body)
        else if (line.startsWith('--data') || line.startsWith('--data-raw')) {
            const match = line.match(/--data(?:-raw)?\s+'([\s\S]+)'/);
            if (match)
                result.body = match[1];
        }
    }
    return result;
}
exports.parseCurl = parseCurl;
