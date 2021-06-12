import chalk from 'chalk';
import chokidar from 'chokidar';
import fs from 'fs';
import { inject, injectable } from 'inversify';
import path from 'path';
import PostCss from 'postcss';

import { ConfigManager } from './ConfigManager';
import { EventBus } from './EventBus';
import { manager } from './manager';

// eslint-disable-next-line import/no-commonjs
const postCssPlugins = [require('postcss-import'), require('autoprefixer')];

@injectable()
@manager()
export class StylesheetsManager {
    postcss = PostCss(postCssPlugins);

    constructor(
        @inject(ConfigManager)
        protected config: ConfigManager,
        @inject(EventBus)
        protected events: EventBus,
    ) {}

    async init() {
        await this.buildStylesheets();
    }

    watch() {
        chokidar.watch(this.config.stylesheetsDir)
            .on('change', () => this.buildStylesheets());
        chokidar.watch(`${this.config.distDir}/**/*.css`)
            .on('change', file => {
                const cssFile = path.relative(this.config.distDir, file);
                console.info(chalk.yellow('watch'), 'stylesheet changed', cssFile);
                this.events.emit('watch', {
                    type: 'cssChanged',
                    cssFile,
                });
            });
    }

    async buildStylesheets() {
        const promises = this.config.options.stylesheets.map(_ => this.buildStylesheet(_));
        await Promise.all(promises);
    }

    async buildStylesheet(filename: string) {
        const srcFile = path.join(this.config.stylesheetsDir, filename);
        const dstFile = path.join(this.config.distDir, filename);
        const srcCss = await fs.promises.readFile(srcFile, 'utf-8');
        const result = await this.postcss.process(srcCss, {
            from: srcFile,
            to: dstFile,
        });
        await fs.promises.writeFile(dstFile, result.css, 'utf-8');
        console.info(chalk.green(`Built ${filename}`));
    }

}
