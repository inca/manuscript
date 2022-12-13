import { dep } from '@nodescript/mesh';
import chalk from 'chalk';
import chokidar from 'chokidar';
import { promises as fs } from 'fs';
import glob from 'glob';
import path from 'path';
import { promisify } from 'util';

import { ConfigManager } from './ConfigManager';
import { EventBus } from './EventBus';
import { manager } from './manager';

const globAsync = promisify(glob);

/**
 * Copies static assets at build time.
 */
@manager()
export class StaticManager {

    @dep() config!: ConfigManager;
    @dep() events!: EventBus;

    init() {}

    build() {
        return this.copyStaticFiles();
    }

    watch() {
        chokidar.watch(`${this.config.staticDir}/**/*`)
            .on('change', file => {
                console.info(chalk.yellow('watch'), 'static file changed', file);
                this.events.emit('watch', { type: 'reloadNeeded' });
            });
    }

    async copyStaticFiles() {
        const files = await globAsync('**/*', {
            cwd: this.config.staticDir,
            nodir: true,
        });
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
