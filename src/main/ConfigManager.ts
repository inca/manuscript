import chalk from 'chalk';
import chokidar from 'chokidar';
import fs from 'fs';
import glob from 'glob';
import { dep } from 'mesh-ioc';
import path from 'path';
import copy from 'recursive-copy';
import { promisify } from 'util';
import Yaml from 'yaml';

import { EventBus } from './EventBus';
import { manager } from './manager';
import { Link, ScriptEntry, StylesheetEntry } from './types';
import { clone, isFileExistsSync } from './util';

const globAsync = promisify(glob);

export interface WorkspaceOptions {
    siteTitle: string;
    titleDelimiter: string;
    themeColor: string;
    lang: string;
    description: string;
    charset: string;
    favicon: string;
    isProduction: boolean;
    cssUrls: string[];
    stylesheets: StylesheetEntry[];
    scripts: ScriptEntry[];
    navbar: Link[];
    logoImage: string;
    logoTitle: string;
    logoSize: number;
    title?: string;
    customBlocks: string[];
    [key: string]: any;
}

/**
 * Reads config options from `manuscript.yaml` and manages default directory layout.
 */
@manager()
export class ConfigManager {
    protected options: WorkspaceOptions = this.getDefaultOptions();

    @dep({ key: 'rootDir' }) rootDir!: string;
    @dep({ key: 'optionOverrides' }) optionOverrides!: WorkspaceOptions;
    @dep() events!: EventBus;

    async init() {
        await this.createDirs();
        await this.copyResources();
        await this.readOptionsFile();
    }

    build() {}

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

    get scriptsDir() {
        return path.resolve(this.rootDir, 'scripts');
    }

    get optionsFile() {
        return path.resolve(this.rootDir, 'manuscript.yaml');
    }

    getOptions() {
        return this.normalizeOptions(this.options);
    }

    protected async readOptionsFile() {
        const file = this.optionsFile;
        if (!isFileExistsSync(file)) {
            await fs.promises.writeFile(file, Yaml.stringify(this.options), 'utf-8');
        }
        try {
            const text = await fs.promises.readFile(file, 'utf-8');
            const opts = Yaml.parse(text);
            this.options = {
                ...this.getDefaultOptions(),
                ...opts,
                ...this.optionOverrides,
            };
        } catch (err) { }
    }

    protected async createDirs() {
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

    protected getDefaultOptions(): WorkspaceOptions {
        return {
            isProduction: process.env.NODE_ENV === 'production',
            siteTitle: 'My Awesome Website',
            titleDelimiter: ' · ',
            description: '',
            charset: 'utf-8',
            lang: 'en',
            favicon: '/favicon.ico',
            themeColor: '#fff',
            cssUrls: [],
            navbar: [],
            logoImage: '/logo.png',
            logoTitle: 'My Awesome Website',
            logoSize: 48,
            stylesheets: [
                { name: 'index.css' },
            ],
            scripts: [
                { name: 'index.ts' },
            ],
            customBlocks: []
        };
    }

    protected async copyResources() {
        const resourcesDir = path.join(__dirname, '../../resources');
        const resources = await globAsync('**/*', { cwd: resourcesDir });
        for (const filename of resources) {
            const sourceFile = path.join(resourcesDir, filename);
            const targetFile = path.join(this.rootDir, filename);
            await fs.promises.mkdir(path.dirname(targetFile), { recursive: true });
            const exists = await fs.promises.stat(targetFile).then(_ => true, _ => false);
            if (exists) {
                continue;
            }
            await copy(sourceFile, targetFile, { overwrite: false });
            console.info('Created', chalk.green(filename));
        }
    }

    protected normalizeOptions(options: WorkspaceOptions): WorkspaceOptions {
        const opts = clone(options);
        for (const entry of opts.scripts) {
            entry.name = entry.name.replace(/\.(ts|js)$/gi, '');
            entry.source = entry.source ?? entry.name + '.ts';
        }
        for (const entry of opts.stylesheets) {
            entry.name = entry.name.replace(/\.css$/gi, '');
            entry.source = entry.source ?? entry.name + '.css';
        }
        return opts;
    }

}
