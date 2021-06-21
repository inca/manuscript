import { inject, injectable } from 'inversify';

import { manager } from './manager';
import { TemplateManager } from './TemplatesManager';

@manager()
@injectable()
export class PagesManager {

    constructor(
        @inject(TemplateManager)
        protected templates: TemplateManager,
    ) {}

    init() {}

    build() {}

    watch() {}

    async renderSinglePage(id: string): Promise<Page> {
        return {
            id,
            title: '',
        };
    }

}

export interface Page {
    // Filename relative to pagesDir, without extension (e.g. pages/index.md has `index` id)
    id: string;
    title: string;
}
