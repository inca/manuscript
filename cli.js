#!/usr/bin/env node
const { Command } = require('commander');
const fs = require('fs');
const path = require('path');

const { Workspace } = require('./out/main/Workspace');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, './package.json'), 'utf-8'));

const program = new Command()
    .version(pkg.version);

program.command('dev')
    .description('Start dev server')
    .option('-r, --root <root>', 'Root directory', process.cwd())
    .option('-p, --port <port>', 'Port', 8888)
    .action(opts => {
        const workspace = new Workspace(opts.root);
        workspace.serve(opts.port);
    });

program.command('build')
    .description('Build all assets')
    .option('-r, --root <root>', 'Root directory', process.cwd())
    .action(opts => {
        const workspace = new Workspace(opts.root, {
            isProduction: true,
        });
        workspace.build();
    });

program.parse();
