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
