import chalk from 'chalk';
import http from 'http';
import { inject, injectable } from 'inversify';
import Koa from 'koa';
import serveStatic from 'koa-static';
import path from 'path';
import ws from 'ws';

import { ConfigManager } from './ConfigManager';
import { EventBus } from './EventBus';
import { TemplateManager } from './TemplatesManager';

@injectable()
export class DevServer {
    wss: ws.Server | null = null;
    server: http.Server | null = null;
    koa: Koa | null = null;

    constructor(
        @inject(ConfigManager)
        protected config: ConfigManager,
        @inject(EventBus)
        protected events: EventBus,
        @inject(TemplateManager)
        protected templates: TemplateManager,
    ) {

    }

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
                // Try templates/pages/*.pug
                const template = this.templates.resolveTemplate(path.join('pages', ctx.path));
                if (template) {
                    ctx.type = 'text/html';
                    ctx.body = await this.templates.renderTemplate(template, {}, false);
                    return;
                }
                // TODO add pages support
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

        ws.onclose = function() {
            setTimeout(connectDev, 500);
        };

        ws.onopen = function() {
            console.info('Connected to dev server');
        };

        ws.onmessage = function(ev: MessageEvent) {
            const payload = JSON.parse(ev.data);
            switch (payload.type) {
                case 'cssChanged':
                    return onCssChanged(payload.cssFile);
                case 'templateChanged':
                case 'reloadNeeded':
                    return location.reload();
            }
        };

        ws.onerror = function(ev) {
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
}
