import chalk from 'chalk';
import chokidar from 'chokidar';
import { promises as fs } from 'fs';
import glob from 'glob';
import Markdown from 'markdown-it';
import { dep } from 'mesh-ioc';
import path from 'path';
import { promisify } from 'util';
import Yaml from 'yaml';

import { ConfigManager } from './ConfigManager';
import { EventBus } from './EventBus';
import { manager } from './manager';
import { TemplateManager } from './TemplatesManager';
import { Page } from './types';
import { extractHeadings, isFileExists, readFrontMatter } from './util';

const globAsync = promisify(glob);

@manager()
export class PagesManager {

    @dep() config!: ConfigManager;
    @dep() templates!: TemplateManager;
    @dep() events!: EventBus;

    protected md: Markdown;
    // Caches the contents of `pages/**/index.yaml` files
    // Directory name is used as cache key, not the filename
    protected optionsFileCache: Map<string, any> = new Map();

    constructor() {
        this.md = new Markdown({
            html: true,
            linkify: true,
            typographer: true,
        });
    }

    async init() {
        for (const customBlock of this.config.getOptions().customBlocks) {
            this.md.use(require('markdown-it-container'), customBlock);
        }
    }

    async build() {
        const allPages = await this.getAllPages();
        for (const page of allPages) {
            const html = await this.renderPage(page);
            await fs.writeFile(page.targetFile, html);
            console.info('Built page', chalk.green(page.id));
        }
    }

    watch() {
        chokidar.watch(`${this.config.pagesDir}/**/index.yaml`)
            .on('change', file => {
                this.optionsFileCache.delete(file);
                console.info(chalk.yellow('watch'), 'page options changed', file);
                this.events.emit('watch', { type: 'reloadNeeded' });
            });
        chokidar.watch(`${this.config.pagesDir}/**/*.md`)
            .on('change', file => {
                const pageId = this.normalizeId(path.relative(this.config.pagesDir, file));
                console.info(chalk.yellow('watch'), 'page changed', pageId);
                this.events.emit('watch', { type: 'pageChanged', pageId });
            });
    }

    async renderPage(page: Page): Promise<string> {
        const pageTemplate = this.templates.resolveTemplate('@page.pug')!;
        return await this.templates.renderFile(pageTemplate, {
            opts: { ...page.opts, title: page.title },
            page,
        });
    }

    async getAllPages(): Promise<Page[]> {
        const files = await globAsync('**/*.md', { cwd: this.config.pagesDir });
        const promises = files.map(f => this.getPage(f));
        return (await Promise.all(promises)).filter((page): page is Page => page != null);
    }

    async getPage(id: string): Promise<Page | null> {
        id = this.normalizeId(id);
        const sourceFile = await this.getSourceFile(id);
        if (!sourceFile) {
            return null;
        }
        const targetFile = path.join(this.config.distDir, id + '.html');
        const baseOpts = await this.readOptions(sourceFile);
        const originalText = await fs.readFile(sourceFile, 'utf-8');
        const [text, frontMatterOpts] = readFrontMatter(originalText);
        const opts = {
            ...baseOpts,
            ...frontMatterOpts,
        };
        const html = this.md.render(text);
        const headings = extractHeadings(html);
        const title = headings[0]?.text;
        return {
            id,
            title,
            sourceFile,
            targetFile,
            text,
            html,
            headings,
            opts,
        };
    }

    protected async getSourceFile(id: string) {
        const files = [
            path.join(this.config.pagesDir, id + '.md'),
            path.join(this.config.pagesDir, id, 'index.md'),
        ];
        for (const file of files) {
            const exists = await isFileExists(file);
            if (exists) {
                return file;
            }
        }
        return null;
    }

    protected async readOptions(srcFile: string) {
        const dir = path.dirname(srcFile);
        const optionsFile = path.join(dir, 'index.yaml');
        const cached = this.optionsFileCache.get(optionsFile);
        if (cached) {
            return cached;
        }
        try {
            const content = await fs.readFile(optionsFile, 'utf-8');
            const opts = Yaml.parse(content);
            this.optionsFileCache.set(optionsFile, opts);
            return opts;
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.warn(`Could not read ${optionsFile}`, err.message);
            }
            return {};
        }
    }

    protected normalizeId(id: string) {
        return id
            .replace(/\.(md|html?)$/gi, '')
            .replace(/^\/+/, '')
            .replace(/\/+$/, '')
            .replace(/\/index/gi, '');
    }

}
