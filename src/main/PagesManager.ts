import { inject, injectable } from 'inversify';

import { manager } from './manager';
import { TemplateManager } from './TemplatesManager';
import { Page } from './types';

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
