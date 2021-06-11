import fs from 'fs';
import path from 'path';
import pug from 'pug';
import Yaml from 'yaml';

import { RenderOptions } from './types';

const defaultTemplatesDir = path.resolve(__dirname, '../templates');

export interface WorkspaceConfig {
    rootDir: string;
}

export class Workspace {
    globalOptions: RenderOptions = {
        title: '👻',
        description: '',
        charset: 'utf-8',
        lang: 'en',
        favicon: '/favicon.ico',
        themeColor: '#fff',
    };

    constructor(public config: WorkspaceConfig) {}

    get staticDir() {
        return path.resolve(this.config.rootDir, 'static');
    }

    get templatesDir() {
        return path.resolve(this.config.rootDir, 'templates');
    }

    get pagesDir() {
        return path.resolve(this.config.rootDir, 'pages');
    }

    get stylesheetsDir() {
        return path.resolve(this.config.rootDir, 'stylesheets');
    }

    get optionsFile() {
        return path.resolve(this.config.rootDir, 'manuscript.yaml');
    }

    async init() {
        this.readGlobalOptions();
    }

    async startDev() {
        this.init();
        const res = await this.renderTemplate('foo.pug', {
            opts: this.globalOptions,
        });
        // console.log('res', res);
    }

    async renderTemplate(template: string, data: any): Promise<string> {
        template = this.resolveTemplate(template);
        const res = pug.renderFile(template, {
            basedir: this.templatesDir,
            filename: template,
            plugins: [
                {
                    resolve: (filename: string, source: string, _loadOptions: any) => {
                        const file = this.resolveTemplate(filename, source);
                        return file;
                    },
                }
            ],
            ...data,
        });
        return res;
    }

    resolveTemplate(template: string, sourceFile: string = '') {
        const filename = template.endsWith('.pug') ? template : template + '.pug';
        const isRelative = this.isRelativePath(template);
        const fallbackFiles: string[] = [];
        if (isRelative && sourceFile) {
            const dir = path.dirname(sourceFile);
            fallbackFiles.push(path.resolve(dir, filename));
        } else {
            fallbackFiles.push(path.join(this.templatesDir, filename));
            fallbackFiles.push(path.join(defaultTemplatesDir, filename));
        }
        for (const file of fallbackFiles) {
            if (this.isFileExists(file)) {
                return file;
            }
        }
        throw new Error(`Template not found: ${template}`);
    }

    protected isFileExists(file: string) {
        try {
            return fs.statSync(file).isFile();
        } catch (err) {
            if (err.code === 'ENOENT') {
                return false;
            }
            throw err;
        }
    }

    protected isRelativePath(file: string) {
        return /^\.+\//.test(file);
    }

    protected readGlobalOptions() {
        const file = this.optionsFile;
        if (!this.isFileExists(file)) {
            fs.writeFileSync(file, Yaml.stringify(this.globalOptions), 'utf-8');
        }
        try {
            const text = fs.readFileSync(file, 'utf-8');
            const opts = Yaml.parse(text);
            Object.assign(this.globalOptions, opts);
        } catch (err) { }
    }

}
