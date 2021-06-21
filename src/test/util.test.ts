import assert from 'assert';

import { readFrontMatter } from '../main/util';

describe('util', () => {

    describe('readFrontMatter', () => {

        it('read frontmatter, stripping the text', () => {
            const [text, data] = readFrontMatter(`
---
foo: 123
bar:
- 1
- 2
- 3
---

# Hello

Some text`);
            assert.strictEqual(text.trim(), `# Hello\n\nSome text`);
            assert.deepStrictEqual(data, { foo: 123, bar: [1, 2, 3] });
        });

        it('reads empty object when no frontmatter exists', () => {
            const [text, data] = readFrontMatter(`# Hello

Some text`);
            assert.strictEqual(text.trim(), `# Hello\n\nSome text`);
            assert.deepStrictEqual(data, {});
        });

        it('ignores invalid frontmatter, but still strips it', () => {
            const [text, data] = readFrontMatter(`
---
someInvalidYaml
---

# Hello

Some text`);
            assert.strictEqual(text.trim(), `# Hello\n\nSome text`);
            assert.deepStrictEqual(data, {});
        });

    });

});
