import chalk from 'chalk';
import { dep } from 'mesh-ioc';
import path from 'path';
import TerserPlugin from 'terser-webpack-plugin';
import { VueLoaderPlugin } from 'vue-loader';
import { Compiler, Configuration, EntryObject, Stats, Watching, webpack } from 'webpack';

import { ConfigManager } from './ConfigManager';
import { EventBus } from './EventBus';
import { manager } from './manager';

@manager()
export class ScriptsManager {

    @dep() config!: ConfigManager;
    @dep() events!: EventBus;

    compiler: Compiler | null = null;
    watcher: Watching | null = null;

    init() {}

    async build() {
        const compiler = this.createCompiler();
        await new Promise<void>((resolve, reject) => {
            compiler.run((err, stats) => {
                if (err) { reject(err); }
                if (!stats) {
                    return;
                }
                this.logStats(stats);
                compiler.close(err => {
                    if (err) { reject(err); }
                    resolve();
                });
            });
        });
    }

    watch() {
        const compiler = this.createCompiler();
        this.watcher = compiler.watch({
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

    protected createCompiler() {
        return webpack(this.buildWebpackConfig());
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
                    vue$: 'vue/dist/vue.esm-bundler.js',
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
                        resourceQuery: /raw/,
                        type: 'asset/source',
                    },
                    {
                        resourceQuery: /inline/,
                        type: 'asset/inline',
                    },
                    {
                        test: /\.(png|jpe?g|svg)$/,
                        resourceQuery: { not: [/raw/, /inline/] },
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
                            // opts.isProduction ? MiniCssExtractPlugin.loader : 'vue-style-loader',
                            'vue-style-loader',
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
                // new MiniCssExtractPlugin(),
            ],
            optimization: {
                minimize: true,
                minimizer: [
                    new TerserPlugin({
                        terserOptions: {
                            keep_classnames: true,
                            keep_fnames: true,
                        },
                    }),
                ],
            },
        };
    }

    protected buildWebpackEntry(): EntryObject {
        const res: EntryObject = {};
        for (const entry of this.config.getOptions().scripts) {
            const name = entry.name.replace(/\.(js|ts)/gi, '');
            const source = entry.source ?? entry.name;
            res[name] = ['./scripts', source].filter(Boolean).join('/');
        }
        return res;
    }

}
