import chalk from 'chalk';
import chokidar from 'chokidar';
import { promises as fs } from 'fs';
import glob from 'glob';
import Markdown from 'markdown-it';
import markdownItContainer from 'markdown-it-container';
import { dep } from 'mesh-ioc';
import path from 'path';
import { promisify } from 'util';
import Yaml from 'yaml';

import { ConfigManager } from './ConfigManager.js';
import { EventBus } from './EventBus.js';
import { manager } from './manager.js';
import { Page } from './types.js';
import { extractHeadings, isFileExists, readFrontMatter } from './util.js';

const globAsync = promisify(glob);

@manager()
export class PagesManager {

    @dep() config!: ConfigManager;
    @dep() events!: EventBus;

    protected md: Markdown;
    // Cache pageId -> Page
    protected pageCache = new Map<string, Page>();
    // Cache the contents of `pages/**/index.yaml` files
    // Directory name is used as cache key, not the filename
    protected optionsFileCache = new Map<string, any>();

    constructor() {
        this.md = new Markdown({
            html: true,
            linkify: true,
            typographer: true,
        });
    }

    async init() {
        for (const customBlock of this.config.getOptions().customBlocks) {
            this.md.use(markdownItContainer, customBlock);
        }
    }

    async build() {}

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
                this.pageCache.delete(pageId);
                console.info(chalk.yellow('watch'), 'page changed', pageId);
                this.events.emit('watch', { type: 'pageChanged', pageId });
            });
    }

    async getAllPages(): Promise<Page[]> {
        const files = await globAsync('**/*.md', { cwd: this.config.pagesDir });
        const promises = files.map(f => this.getPage(f));
        return (await Promise.all(promises)).filter((page): page is Page => page != null);
    }

    async getPage(id: string): Promise<Page | null> {
        id = this.normalizeId(id);
        const existing = this.pageCache.get(id);
        if (existing) {
            return existing;
        }
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
        const page: Page = {
            id,
            title,
            sourceFile,
            targetFile,
            text,
            html,
            headings,
            opts,
        };
        this.pageCache.set(id, page);
        return page;
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
        } catch (err: any) {
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
