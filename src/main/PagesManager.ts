import { promises as fs } from 'fs';
import { inject, injectable } from 'inversify';
import Markdown from 'markdown-it';
import path from 'path';

import { ConfigManager } from './ConfigManager';
import { manager } from './manager';
import { TemplateManager } from './TemplatesManager';
import { Page } from './types';
import { readFrontMatter } from './util';

@manager()
@injectable()
export class PagesManager {
    protected md: Markdown;
    // Caches the contents of `pages/**/index.yaml` files
    // Directory name is used as cache key, not the filename
    protected optionsFileCache: Map<string, any> = new Map();

    constructor(
        @inject(ConfigManager)
        protected config: ConfigManager,
        @inject(TemplateManager)
        protected templates: TemplateManager,
    ) {
        this.md = new Markdown({
            html: true,
            linkify: true,
            typographer: true,
        });
    }

    init() {}

    build() {}

    watch() {}

    async renderPage(id: string): Promise<string | null> {
        const page = await this.getPage(id);
        if (!page) {
            return null;
        }
        const pageTemplate = this.templates.resolveTemplate('@page.pug')!;
        return await this.templates.renderFile(pageTemplate, {
            opts: page.opts,
            page,
        });
    }

    async getPage(id: string): Promise<Page | null> {
        try {
            id = this.normalizeId(id);
            const file = path.join(this.config.pagesDir, id + '.md');
            // TODO read options file
            const originalText = await fs.readFile(file, 'utf-8');
            const [text, frontMatterOpts] = readFrontMatter(originalText);
            const opts = {
                ...frontMatterOpts,
            };
            const html = this.md.render(text);
            return {
                id,
                title: '', // TODO infer title
                text,
                html,
                opts,
            };
        } catch (err) {
            if (err.code === 'ENOENT') {
                return null;
            }
            throw err;
        }
    }

    protected normalizeId(id: string) {
        return id
            .replace(/\.(md|html?)$/gi, '')
            .replace(/^\/+/, '')
            .replace(/\/+$/, '');
    }

}
