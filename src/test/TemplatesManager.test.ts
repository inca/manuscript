import assert from 'assert';
import path from 'path';

import { TemplateManager } from '../main/TemplatesManager';
import { createTestWorkspace } from './helpers';

describe('TemplatesManager', () => {

    describe('resolveTemplate', () => {

        context('path starts with @', () => {

            it('resolves local template if it exists', async () => {
                const workspace = await createTestWorkspace([
                    ['templates/pages/foo.pug', 'Some page']
                ]);
                const templates = workspace.container.get(TemplateManager);
                const resolved = templates.resolveTemplate('@pages/foo.pug');
                assert.ok(resolved?.startsWith(workspace.rootDir));
            });

            it('resolves bundled template if local does not exist', async () => {
                const workspace = await createTestWorkspace([]);
                const templates = workspace.container.get(TemplateManager);
                const resolved = templates.resolveTemplate('@layout.pug');
                assert.ok(resolved?.startsWith(path.resolve(__dirname, '../..')));
            });

            it('resolves local template if both bundled and local exist (local takes prio)', async () => {
                const workspace = await createTestWorkspace([
                    ['templates/layout.pug', 'Some layout']
                ]);
                const templates = workspace.container.get(TemplateManager);
                const resolved = templates.resolveTemplate('@layout.pug');
                assert.ok(resolved?.startsWith(workspace.rootDir));
            });

            it('resolves null if not found in any of the locations', async () => {
                const workspace = await createTestWorkspace([]);
                const templates = workspace.container.get(TemplateManager);
                const resolved = templates.resolveTemplate('@foo.pug');
                assert.strictEqual(resolved, null);
            });

        });

        context('relative paths', () => {

            it('resolves relative local file', async () => {
                const workspace = await createTestWorkspace([
                    ['templates/pages/foo.pug', 'Some page'],
                    ['templates/components/icon.pug', 'Some icon'],
                ]);
                const templates = workspace.container.get(TemplateManager);
                const source = templates.resolveTemplate('@pages/foo.pug')!;
                const resolved = templates.resolveTemplate('../components/icon.pug', source)!;
                assert.ok(resolved.startsWith(path.resolve(workspace.rootDir, 'templates/components')));
            });

            it('resolves relative file of bundled template, even when local template with the same name exists', async () => {
                const workspace = await createTestWorkspace([
                    ['templates/root.pug', 'Some root'],
                ]);
                const templates = workspace.container.get(TemplateManager);
                const source = templates.resolveTemplate('@layout.pug')!;
                const resolved = templates.resolveTemplate('./root.pug', source)!;
                assert.ok(resolved.startsWith(path.resolve(__dirname, '../../templates')));
            });

            it('resolves null if relative file is not found', async () => {
                const workspace = await createTestWorkspace([
                    ['templates/foo.pug', 'Some page'],
                ]);
                const templates = workspace.container.get(TemplateManager);
                const source = templates.resolveTemplate('@foo.pug')!;
                const resolved = templates.resolveTemplate('./layout.pug', source);
                assert.ok(resolved == null);
            });

        });

    });

});
