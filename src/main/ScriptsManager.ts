import chalk from 'chalk';
import { inject, injectable } from 'inversify';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import path from 'path';
import { VueLoaderPlugin } from 'vue-loader';
import { Compiler, Configuration, EntryObject, Stats, Watching, webpack } from 'webpack';

import { ConfigManager } from './ConfigManager';
import { EventBus } from './EventBus';
import { manager } from './manager';

@injectable()
@manager()
export class ScriptsManager {
    compiler: Compiler;
    watcher: Watching | null = null;

    constructor(
        @inject(ConfigManager)
        protected config: ConfigManager,
        @inject(EventBus)
        protected events: EventBus,
    ) {
        this.compiler = webpack(this.buildWebpackConfig());
    }

    init() {}

    async build() {
        await new Promise<void>((resolve, reject) => {
            this.compiler.run((err, stats) => {
                if (err) { reject(err); }
                if (!stats) {
                    return;
                }
                this.logStats(stats);
                this.compiler.close(err => {
                    if (err) { reject(err); }
                    resolve();
                });
            });
        });
    }

    watch() {
        this.watcher = this.compiler.watch({
            ignored: ['**/node_modules']
        }, (err, stats) => {
            if (err) {
                console.error(chalk.red(err.message));
                return;
            }
            if (!stats) {
                return;
            }
            this.logStats(stats);
            for (const asset of stats.toJson().assets ?? []) {
                if (asset.emitted) {
                    this.events.emit('watch', { type: 'scriptChanged', name: asset.name });
                }
            }
        });
    }

    protected logStats(stats: Stats) {
        const info = stats.toJson();
        for (const { message, details } of info.errors ?? []) {
            console.error(chalk.red(message));
            if (details) {
                console.error(chalk.gray(details));
            }
        }
        for (const { message, details } of info.warnings ?? []) {
            console.warn(chalk.yellow(message));
            if (details) {
                console.error(chalk.gray(details));
            }
        }
        for (const asset of info.assets ?? []) {
            console.info('Built asset', chalk.green(asset.name));
        }
    }

    protected buildWebpackConfig(): Configuration {
        const opts = this.config.getOptions();
        return {
            mode: opts.isProduction ? 'production' : 'development',
            devtool: opts.isProduction ? false : 'cheap-source-map',
            entry: this.buildWebpackEntry(),
            output: {
                filename: '[name].js',
                path: this.config.distDir,
            },
            resolve: {
                alias: {
                    vue$: 'vue/dist/vue.runtime.esm-bundler.js',
                    '@': this.config.scriptsDir,
                },
                extensions: ['.tsx', '.ts', '.js', '.vue'],
            },
            resolveLoader: {
                modules: [
                    path.join(__dirname, '../../node_modules'),
                    'node_modules',
                ]
            },
            module: {
                rules: [
                    {
                        test: /\.(png|svg)$/,
                        type: 'asset/resource'
                    },
                    {
                        test: /\.tsx?$/,
                        exclude: /node_modules/,
                        use: {
                            loader: 'ts-loader',
                            options: {}
                        },
                    },
                    {
                        test: /\.vue$/,
                        loader: 'vue-loader'
                    },
                    {
                        test: /\.css$/,
                        use: [
                            opts.isProduction ? MiniCssExtractPlugin.loader : 'vue-style-loader',
                            {
                                loader: 'css-loader',
                                options: {
                                    importLoaders: 1,
                                },
                            },
                            'postcss-loader',
                        ]
                    }
                ]
            },
            plugins: [
                new VueLoaderPlugin() as any,
                new MiniCssExtractPlugin(),
            ]
        };
    }

    protected buildWebpackEntry(): EntryObject {
        const res: EntryObject = {};
        for (const scriptFile of this.config.getOptions().scripts) {
            const { dir, ext, name } = path.parse(scriptFile);
            res[name] = ['./scripts', dir, name + ext].filter(Boolean).join('/');
        }
        return res;
    }

}
