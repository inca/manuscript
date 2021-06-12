import chalk from 'chalk';
import chokidar from 'chokidar';
import { inject, injectable } from 'inversify';
import path from 'path';
import pug from 'pug';

import { ConfigManager } from './ConfigManager';
import { EventBus } from './EventBus';
import { manager } from './manager';
import { clone, isFileExists } from './util';

const defaultTemplatesDir = path.resolve(__dirname, '../templates');

@injectable()
@manager()
export class TemplateManager {

    constructor(
        @inject(ConfigManager)
        protected config: ConfigManager,
        @inject(EventBus)
        protected events: EventBus,
    ) {}

    async init() {
        // TODO add build templates
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

    async renderTemplate(template: string, data: any, resolve: boolean = true): Promise<string> {
        if (resolve) {
            template = this.getTemplate(template);
        }
        const opts = this.createRenderOptions(data);
        const res = pug.renderFile(template, {
            basedir: this.config.templatesDir,
            filename: template,
            plugins: [
                {
                    resolve: (filename: string, source: string, _loadOptions: any) => {
                        return this.getTemplate(filename, source);
                    },
                }
            ],
            opts,
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

    protected createRenderOptions(data: any) {
        return clone({ ...this.config.options, ...data });
    }

}
