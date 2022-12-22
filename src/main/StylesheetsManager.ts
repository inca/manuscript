import chalk from 'chalk';
import chokidar from 'chokidar';
import fs from 'fs';
import { dep } from 'mesh-ioc';
import path from 'path';
import { default as PostCss } from 'postcss';

import { ConfigManager } from './ConfigManager.js';
import { EventBus } from './EventBus.js';
import { manager } from './manager.js';
import { StylesheetEntry } from './types.js';

const { default: postCssImport } = await import('postcss-import');
const { default: postCssNested } = await import('postcss-nested');
const { default: autoprefixer } = await import('autoprefixer');

const postCssPlugins = [
    postCssImport,
    postCssNested,
    autoprefixer,
];

/**
 * Compiles/watches stylesheets using PostCSS.
 */
@manager()
export class StylesheetsManager {

    @dep() config!: ConfigManager;
    @dep() events!: EventBus;

    postcss = (PostCss as any)(postCssPlugins);

    async init() {
        await this.buildStylesheets();
    }

    build() {}

    watch() {
        chokidar.watch(this.config.stylesheetsDir)
            .on('change', () => this.buildStylesheets());
        chokidar.watch(`${this.config.distDir}/**/*.css`)
            .on('change', file => {
                const cssFile = path.relative(this.config.distDir, file);
                console.info(chalk.yellow('watch'), 'stylesheet changed', cssFile);
                this.events.emit('watch', { type: 'cssChanged', cssFile });
            });
    }

    async buildStylesheets() {
        const promises = this.config.getOptions().stylesheets.map(_ => this.buildStylesheet(_));
        await Promise.all(promises);
    }

    protected async buildStylesheet(entry: StylesheetEntry) {
        const srcFile = path.join(this.config.stylesheetsDir, entry.source ?? entry.name);
        const dstFile = path.join(this.config.distDir, entry.name + '.css');
        const srcCss = await fs.promises.readFile(srcFile, 'utf-8');
        const result = await this.postcss.process(srcCss, {
            from: srcFile,
            to: dstFile,
        });
        await fs.promises.writeFile(dstFile, result.css, 'utf-8');
        console.info('Built stylesheet', chalk.green(entry.name + '.css'));
    }

}
