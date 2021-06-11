#!/usr/bin/env node
const { Command } = require('commander');
const fs = require('fs');
const path = require('path');

const { dev } = require('./out/cli/dev');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, './package.json'), 'utf-8'));

const program = new Command()
    .version(pkg.version);

program.command('dev')
    .description('Start dev server')
    .option('-r, --root <root>', 'Root directory', process.cwd())
    .option('-p, --port <port>', 'Port', 5000)
    .action(opts => {
        dev({
            root: opts.root,
            port: opts.port,
        });
    })
    .parse();
