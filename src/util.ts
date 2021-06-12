import fs from 'fs';

export function isRelativePath(file: string) {
    return /^\.+\//.test(file);
}

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
