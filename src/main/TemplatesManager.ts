import chalk from 'chalk';
import chokidar from 'chokidar';
import fs from 'fs';
import glob from 'glob';
import { inject, injectable } from 'inversify';
import path from 'path';
import pug from 'pug';
import { promisify } from 'util';

import { ConfigManager } from './ConfigManager';
import { EventBus } from './EventBus';
import { manager } from './manager';
import { isFileExists } from './util';

const globAsync = promisify(glob);

const defaultTemplatesDir = path.resolve(__dirname, '../../templates');

/**
 * Manages Pug template resolution, rendering and building template-based pages.
 *
 * Manuscript ships with a minimalistic layout, each of which can be overridden
 * by copying a correspinding template to `$ROOT/templates` and editing it.
 *
 * This is made possible by special syntax inside `include` and `extends`:
 * files starting with `@` are first looked up locally (i.e. in `$ROOT/templates`),
 * falling back to predefined templates in this package if not found.
 *
 * For example `@layout/footer` will look for those files and uses the first one found:
 *
 *  - $ROOT/templates/layout/footer.pug
 *  - $ROOT/node_modules/@inca/manuscript/templates/layout/footer.pug
 *
 * Templates under `templates/pages` are served and rendered as is.
 * The layouts are composed in a way that allows for overriding each aspect using blocks.
 * See `root.pug` and `layout.pug` for details.
 */
@injectable()
@manager()
export class TemplateManager {

    constructor(
        @inject(ConfigManager)
        protected config: ConfigManager,
        @inject(EventBus)
        protected events: EventBus,
    ) {}

    init() {}

    async build() {
        await this.buildTemplatePages();
    }

    watch() {
        chokidar.watch([this.config.templatesDir, defaultTemplatesDir])
            .on('change', file => {
                console.info(chalk.yellow('watch'), 'template changed', file);
                this.events.emit('watch', {
                    type: 'templateChanged',
                    file,
                });
            });
    }

    async renderFile(file: string, data: any = {}): Promise<string> {
        const { opts: optOverrides, ...restData } = data;
        const opts = { ...this.config.getOptions(), ...optOverrides };
        const res = pug.renderFile(file, {
            basedir: this.config.templatesDir,
            filename: file,
            plugins: [
                {
                    resolve: (filename: string, source: string, _loadOptions: any) => {
                        return this.getTemplate(filename, source);
                    },
                }
            ],
            opts,
            ...restData,
        });
        return res;
    }

    getTemplate(template: string, sourceFile: string = '') {
        const file = this.resolveTemplate(template, sourceFile);
        if (file == null) {
            throw new Error(`Template not found: ${template}`);
        }
        return file;
    }

    // Note: resolution is synchronous, because Pug only supports it this way
    resolveTemplate(template: string, sourceFile: string = ''): string | null {
        const filename = template.endsWith('.pug') ? template : template + '.pug';
        const fallbackFiles: string[] = [];
        if (filename.startsWith('@')) {
            fallbackFiles.push(path.join(this.config.templatesDir, filename.substring(1)));
            fallbackFiles.push(path.join(defaultTemplatesDir, filename.substring(1)));
        } else if (sourceFile) {
            const dir = path.dirname(sourceFile);
            fallbackFiles.push(path.resolve(dir, filename));
        } else {
            fallbackFiles.push(path.join(this.config.templatesDir, filename));
        }
        for (const file of fallbackFiles) {
            if (isFileExists(file)) {
                return file;
            }
        }
        return null;
    }

    async buildTemplatePages() {
        const srcDir = path.join(this.config.templatesDir, 'pages');
        const files = await globAsync('**/*.pug', { cwd: srcDir });
        for (const filename of files) {
            const srcFile = path.join(srcDir, filename);
            const targetFile = path.join(this.config.distDir,
                filename.replace(/\.pug$/gi, '.html'));
            const html = await this.renderFile(srcFile);
            await fs.promises.mkdir(path.dirname(targetFile), { recursive: true });
            await fs.promises.writeFile(targetFile, html, 'utf-8');
            console.info(`Built`, chalk.green(filename));
        }
    }

}