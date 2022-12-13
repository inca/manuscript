import { dep } from '@nodescript/mesh';
import chalk from 'chalk';
import http from 'http';
import Koa from 'koa';
import serveStatic from 'koa-static';
import path from 'path';
import ws from 'ws';

import { ConfigManager } from './ConfigManager';
import { EventBus } from './EventBus';
import { PagesManager } from './PagesManager';
import { TemplateManager } from './TemplatesManager';

/**
 * An http server for development.
 *
 * This mimics the website behaviour when it's fully built,
 * but doesn't actually involve building it entirely.
 * Instead it only serves the requested content on demand.
 */
export class DevServer {

    @dep() config!: ConfigManager;
    @dep() events!: EventBus;
    @dep() templates!: TemplateManager;
    @dep() pages!: PagesManager;

    wss: ws.Server | null = null;
    server: http.Server | null = null;
    koa: Koa | null = null;

    async serve(port: number) {
        this.koa = this.createKoa();
        this.server = this.koa.listen(port);
        this.wss = this.createWebSocketServer(this.server);
        console.info(`Hey there 👋`);
        console.info(`Visit ${chalk.green('http://localhost:' + port)} and start hacking!`);
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
        koa.use(serveStatic(this.config.staticDir));
        koa.use(serveStatic(this.config.distDir));
        // TODO render 404
        return koa;
    }

    protected async serveRequest(ctx: Koa.Context, next: Koa.Next) {
        switch (ctx.method) {
            case 'GET': {
                if (ctx.url === '/__dev__.js') {
                    ctx.type = 'text/javascript';
                    ctx.body = `(${devClientScript.toString()})()`;
                    return;
                }
                // Try templates/pages/**/*.pug
                const template = this.templates.resolveTemplate(path.join('@pages', ctx.path));
                if (template) {
                    ctx.type = 'text/html';
                    ctx.body = await this.templates.renderFile(template);
                    return;
                }
                // Try pages/**/*.md
                const page = await this.pages.getPage(ctx.path);
                if (!page) {
                    return next();
                }
                const html = await this.templates.renderPage(page);
                if (html) {
                    ctx.type = 'text/html';
                    ctx.body = html;
                    return;
                }
                break;
            }
        }
        return next();
    }

    protected createWebSocketServer(server: http.Server) {
        const wss = new ws.Server({ server });
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

// This function is sent to client to facilitate auto-reloads
function devClientScript() {
    connectDev();

    function connectDev() {
        const ws = new WebSocket(`ws://${location.host}`);

        ws.onclose = function () {
            setTimeout(connectDev, 500);
        };

        ws.onopen = function () {
            console.info('Connected to dev server');
        };

        ws.onmessage = function (ev: MessageEvent) {
            const payload = JSON.parse(ev.data);
            switch (payload.type) {
                case 'cssChanged':
                    return onCssChanged(payload.cssFile);
                case 'scriptChanged':
                case 'templateChanged':
                case 'reloadNeeded':
                    return location.reload();
                case 'pageChanged':
                    return onPageChanged(payload.pageId);
            }
        };

        ws.onerror = function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            return false;
        };

    }

    function onCssChanged(file: string) {
        const link = document.querySelector(`link[rel="stylesheet"][href^="/${file}"]`);
        if (link) {
            const newHref = link.getAttribute('href')?.replace(/\?.*/, '') + '?' + Date.now();
            link.setAttribute('href', newHref);
        }
    }

    function onPageChanged(pageId: string) {
        const meta = document.querySelector(`meta[name="pageId"][content="${pageId}"]`);
        if (meta) {
            location.reload();
        }
    }

}
