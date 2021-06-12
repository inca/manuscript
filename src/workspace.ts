import chalk from 'chalk';
import chokidar from 'chokidar';
import EventEmitter from 'events';
import fs from 'fs';
import http from 'http';
import Koa from 'koa';
import serveStatic from 'koa-static';
import path from 'path';
import pug from 'pug';
import WebSocket from 'ws';
import Yaml from 'yaml';

import { clientSideDevScript } from './dev';
import { RenderOptions } from './types';
import { isFileExists, isRelativePath } from './util';

const defaultTemplatesDir = path.resolve(__dirname, '../templates');

export interface WorkspaceConfig {
    rootDir: string;
}

export class Workspace {
    events: EventEmitter = new EventEmitter();
    renderOptions: RenderOptions = {
        title: '👻',
        description: '',
        charset: 'utf-8',
        lang: 'en',
        favicon: '/favicon.ico',
        themeColor: '#fff',
        isProduction: process.env.NODE_ENV === 'production',
    };
    wss: WebSocket.Server| null = null;
    server: http.Server | null = null;
    koa: Koa | null = null;

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
        this.createDirs();
        this.readGlobalOptions();
    }

    async serve(port: number) {
        this.init();
        this.koa = this.createKoa();
        this.server = this.koa.listen(port);
        this.wss = this.createWebSocketServer(this.server);
        this.watch();
        console.info(`Hey there 👋`);
        console.info(`Visit ${chalk.green('http://localhost:' + port)} and start hacking!`);
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

    protected getRenderOptions(overrides: Partial<RenderOptions> = {}) {
        return {
            ...this.renderOptions,
            ...overrides,
        };
    }

    protected readGlobalOptions() {
        const file = this.optionsFile;
        if (!isFileExists(file)) {
            fs.writeFileSync(file, Yaml.stringify(this.renderOptions), 'utf-8');
        }
        try {
            const text = fs.readFileSync(file, 'utf-8');
            const opts = Yaml.parse(text);
            Object.assign(this.renderOptions, opts);
        } catch (err) { }
    }

    protected createDirs() {
        const dirs = [
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
                this.readGlobalOptions();
                this.events.emit('watch', { type: 'reloadNeeded' });
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

}
