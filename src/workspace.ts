import chalk from 'chalk';
import chokidar from 'chokidar';
import EventEmitter from 'events';
import fs from 'fs';
import http from 'http';
import Koa from 'koa';
import serveStatic from 'koa-static';
import path from 'path';
import PostCss from 'postcss';
import pug from 'pug';
import WebSocket from 'ws';
import Yaml from 'yaml';

import { getDefaultOptions } from './defaults';
import { clientSideDevScript } from './dev';
import { WorkspaceOptions } from './types';
import { isFileExists, isRelativePath } from './util';

// eslint-disable-next-line import/no-commonjs
const postCssPlugins = [require('postcss-import'), require('autoprefixer')];

const defaultTemplatesDir = path.resolve(__dirname, '../templates');

export interface WorkspaceConfig {
    rootDir: string;
}

export class Workspace {
    events: EventEmitter = new EventEmitter();
    options: WorkspaceOptions = getDefaultOptions();
    wss: WebSocket.Server| null = null;
    server: http.Server | null = null;
    koa: Koa | null = null;
    postcss = PostCss(postCssPlugins);

    constructor(public config: WorkspaceConfig) {}

    get staticDir() {
        return path.resolve(this.config.rootDir, 'static');
    }

    get distDir() {
        return path.resolve(this.config.rootDir, 'dist');
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
        this.createDirs();
        this.readOptionsFile();
    }

    async serve(port: number) {
        this.init();
        this.koa = this.createKoa();
        this.server = this.koa.listen(port);
        this.wss = this.createWebSocketServer(this.server);
        this.watch();
        console.info(`Hey there 👋`);
        console.info(`Visit ${chalk.green('http://localhost:' + port)} and start hacking!`);
        await this.buildStylesheets();
    }

    async renderTemplate(template: string, data: any, resolve: boolean = true): Promise<string> {
        if (resolve) {
            template = this.getTemplate(template);
        }
        const res = pug.renderFile(template, {
            basedir: this.templatesDir,
            filename: template,
            plugins: [
                {
                    resolve: (filename: string, source: string, _loadOptions: any) => {
                        return this.getTemplate(filename, source);
                    },
                }
            ],
            ...data,
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
        const isRelative = isRelativePath(template);
        const fallbackFiles: string[] = [];
        if (isRelative && sourceFile) {
            const dir = path.dirname(sourceFile);
            fallbackFiles.push(path.resolve(dir, filename));
        } else {
            fallbackFiles.push(path.join(this.templatesDir, filename));
            fallbackFiles.push(path.join(defaultTemplatesDir, filename));
        }
        for (const file of fallbackFiles) {
            if (isFileExists(file)) {
                return file;
            }
        }
        return null;
    }

    protected createKoa() {
        const koa = new Koa();
        koa.use((ctx, next) => {
            if (ctx.url === '/') {
                ctx.url = '/index';
            }
            return next();
        });
        koa.use((ctx, next) => this.serveRequest(ctx, next));
        koa.use(serveStatic(this.staticDir));
        koa.use(serveStatic(this.distDir));
        return koa;
    }

    protected async serveRequest(ctx: Koa.Context, next: Koa.Next) {
        switch (ctx.method) {
            case 'GET': {
                if (ctx.url === '/__dev__.js') {
                    ctx.type = 'text/javascript';
                    ctx.body = `(${clientSideDevScript.toString()})()`;
                    return;
                }
                // Try templates/pages/*.pug
                const template = this.resolveTemplate(path.join('pages', ctx.path));
                if (template) {
                    ctx.type = 'text/html';
                    ctx.body = await this.renderTemplate(template, {
                        opts: this.getRenderOptions()
                    }, false);
                    return;
                }
                // TODO add pages support
                break;
            }
        }
        return next();
    }

    protected getRenderOptions(overrides: Partial<WorkspaceOptions> = {}) {
        return {
            ...this.options,
            ...overrides,
        };
    }

    protected readOptionsFile() {
        const file = this.optionsFile;
        if (!isFileExists(file)) {
            fs.writeFileSync(file, Yaml.stringify(this.options), 'utf-8');
        }
        try {
            const text = fs.readFileSync(file, 'utf-8');
            const opts = Yaml.parse(text);
            this.options = {
                ...getDefaultOptions(),
                ...opts,
            };
        } catch (err) { }
    }

    protected createDirs() {
        const dirs = [
            this.distDir,
            this.staticDir,
            this.templatesDir,
            this.pagesDir,
            this.stylesheetsDir,
        ];
        for (const dir of dirs) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    protected watch() {
        chokidar.watch([this.templatesDir, defaultTemplatesDir])
            .on('change', file => {
                console.info(chalk.yellow('watch'), 'template changed', file);
                this.events.emit('watch', {
                    type: 'templateChanged',
                    file,
                });
            });
        chokidar.watch(this.optionsFile)
            .on('change', () => {
                console.info(chalk.yellow('watch'), 'options file changed');
                this.readOptionsFile();
                this.events.emit('watch', { type: 'reloadNeeded' });
            });
        chokidar.watch(this.stylesheetsDir)
            .on('change', () => this.buildStylesheets());
        chokidar.watch(`${this.distDir}/**/*.css`)
            .on('change', file => {
                const cssFile = path.relative(this.distDir, file);
                console.info(chalk.yellow('watch'), 'css changed');
                this.events.emit('watch', {
                    type: 'cssChanged',
                    cssFile,
                });
            });
    }

    protected createWebSocketServer(server: http.Server) {
        const wss = new WebSocket.Server({ server });
        wss.on('connection', ws => {
            this.events.addListener('watch', onWatchEvent);
            ws.on('close', () => {
                this.events.removeListener('watch', onWatchEvent);
            });
            function onWatchEvent(data: any) {
                ws.send(JSON.stringify(data));
            }
        });
        return wss;
    }

    protected async buildStylesheets() {
        const promises = this.options.stylesheets.map(_ => this.buildStylesheet(_));
        await Promise.all(promises);
    }

    protected async buildStylesheet(filename: string) {
        const srcFile = path.join(this.stylesheetsDir, filename);
        const dstFile = path.join(this.distDir, filename);
        const srcCss = await fs.promises.readFile(srcFile, 'utf-8');
        const result = await this.postcss.process(srcCss, {
            from: srcFile,
            to: dstFile,
        });
        await fs.promises.writeFile(dstFile, result.css, 'utf-8');
        console.info(chalk.green(`Built ${filename}`));
    }

}
