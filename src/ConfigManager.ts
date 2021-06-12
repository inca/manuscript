import chalk from 'chalk';
import chokidar from 'chokidar';
import fs from 'fs';
import { inject, injectable } from 'inversify';
import path from 'path';
import Yaml from 'yaml';

import { EventBus } from './EventBus';
import { manager } from './manager';
import { isFileExists, Link } from './util';

export interface WorkspaceOptions {
    title: string;
    themeColor: string;
    lang: string;
    description: string;
    charset: string;
    favicon: string;
    isProduction: boolean;
    cssUrls: string[];
    stylesheets: string[];
    navbar: Link[];
    logoImage: string;
    logoTitle: string;
    [key: string]: any;
}

@injectable()
@manager()
export class ConfigManager {
    options: WorkspaceOptions = this.getDefaultOptions();

    constructor(
        @inject('rootDir')
        public rootDir: string,
        @inject(EventBus)
        protected events: EventBus,
    ) {}

    async init() {
        await this.createDirs();
        await this.readOptionsFile();
    }

    watch() {
        chokidar.watch(this.optionsFile)
            .on('change', () => {
                console.info(chalk.yellow('watch'), 'options file changed');
                this.readOptionsFile();
                this.events.emit('watch', { type: 'reloadNeeded' });
            });
    }

    get staticDir() {
        return path.resolve(this.rootDir, 'static');
    }

    get distDir() {
        return path.resolve(this.rootDir, 'dist');
    }

    get templatesDir() {
        return path.resolve(this.rootDir, 'templates');
    }

    get pagesDir() {
        return path.resolve(this.rootDir, 'pages');
    }

    get stylesheetsDir() {
        return path.resolve(this.rootDir, 'stylesheets');
    }

    get optionsFile() {
        return path.resolve(this.rootDir, 'manuscript.yaml');
    }

    async readOptionsFile() {
        const file = this.optionsFile;
        if (!isFileExists(file)) {
            await fs.promises.writeFile(file, Yaml.stringify(this.options), 'utf-8');
        }
        try {
            const text = await fs.promises.readFile(file, 'utf-8');
            const opts = Yaml.parse(text);
            this.options = {
                ...this.getDefaultOptions(),
                ...opts,
            };
        } catch (err) { }
    }

    async createDirs() {
        const dirs = [
            this.distDir,
            this.staticDir,
            this.templatesDir,
            this.pagesDir,
            this.stylesheetsDir,
        ];
        for (const dir of dirs) {
            await fs.promises.mkdir(dir, { recursive: true });
        }
    }

    getDefaultOptions(): WorkspaceOptions {
        return {
            isProduction: process.env.NODE_ENV === 'production',
            title: 'YAW (Your Awesome Website)',
            description: '',
            charset: 'utf-8',
            lang: 'en',
            favicon: '/favicon.ico',
            themeColor: '#fff',
            cssUrls: [],
            navbar: [],
            logoImage: '/logo.png',
            logoTitle: 'YAW',
            stylesheets: [
                'index.css'
            ]
        };
    }

}
