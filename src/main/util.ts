import fs from 'fs';
import Yaml from 'yaml';

export function isFileExists(file: string) {
    try {
        return fs.statSync(file).isFile();
    } catch (err) {
        if (err.code === 'ENOENT') {
            return false;
        }
        throw err;
    }
}

export function clone<T>(data: T): T {
    return data == null ? null : JSON.parse(JSON.stringify(data));
}

export function readFrontMatter(text: string): [string, any] {
    const data: any = {};
    const strippedText = text.trim().replace(/^---\s*\r?\n([\s\S]*)\r?\n---\s*\r?\n/, (_, frontMatterText) => {
        try {
            const parsed = Yaml.parse(frontMatterText);
            if (typeof parsed === 'object') {
                Object.assign(data, parsed);
            }
        } catch (err) {
            // Invalid YAML is ignored
        }
        return '';
    });
    return [strippedText, data];
}
