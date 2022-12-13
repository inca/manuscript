import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

import { Workspace } from '../main/Workspace.js';

const dirsToCleanup: string[] = [];

/**
 * Creates a temp dir with specified files (array of [filename -> text content] tuples)
 * and returns the Workspace with that dir as its root.
 *
 * The temp dirs created by this method are auto-removed after the tests are finished.
 */
export async function createTestWorkspace(files: Array<[string, string]>): Promise<Workspace> {
    const rootDir = path.join(os.tmpdir(), Math.random().toString(36));
    dirsToCleanup.push(rootDir);
    for (const [filename, content] of files) {
        const file = path.join(rootDir, filename);
        const dir = path.dirname(file);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(file, content, 'utf-8');
    }
    return new Workspace(rootDir);
}

after(async () => {
    for (const dir of dirsToCleanup) {
        await fs.rmdir(dir, { recursive: true });
    }
});
