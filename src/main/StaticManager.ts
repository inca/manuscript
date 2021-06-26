import chalk from 'chalk';
import { promises as fs } from 'fs';
import glob from 'glob';
import { inject, injectable } from 'inversify';
import path from 'path';
import { promisify } from 'util';

import { ConfigManager } from './ConfigManager';
import { manager } from './manager';

const globAsync = promisify(glob);

/**
 * Copies static assets at build time.
 */
@injectable()
@manager()
export class StaticManager {

    constructor(
        @inject(ConfigManager)
        protected config: ConfigManager,
    ) {

    }

    init() {}

    build() {
        return this.copyStaticFiles();
    }

    watch() {}

    async copyStaticFiles() {
        const files = await globAsync('**/*', { cwd: this.config.staticDir });
        const promises = files.map(async f => {
            const srcFile = path.join(this.config.staticDir, f);
            const targetFile = path.join(this.config.distDir, f);
            const targetDir = path.dirname(targetFile);
            await fs.mkdir(targetDir, { recursive: true });
            await fs.copyFile(srcFile, targetFile);
            console.info('Copied static file', chalk.green(f));
        });
        await Promise.all(promises);
    }

}
