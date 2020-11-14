import { Bundler as DefaultBundler } from '@umijs/bundler-webpack';
import { join, resolve } from 'path';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { rimraf, chalk } from '@umijs/utils';
import zlib from 'zlib';


export async function getBundleAndConfigs({
    api,
    port
}) {
    // bundler
    const Bundler = await api.applyPlugins({
        type: api.ApplyPluginsType.modify,
        key: 'modifyBundler',
        initialValue: DefaultBundler
    });

    const bundleImplementor = await api.applyPlugins({
        key: 'modifyBundleImplementor',
        type: api.ApplyPluginsType.modify,
        initialValue: undefined
    });

    const bundler = new Bundler({
        cwd: api.cwd,
        config: api.config
    });
    const bundlerArgs = {
        env: api.env,
        bundler: { id: Bundler.id, version: Bundler.version }
    };
        // get config
    async function getConfig({ type }) {
        const env = api.env === 'production' ? 'production' : 'development';
        const getConfigOpts = await api.applyPlugins({
            type: api.ApplyPluginsType.modify,
            key: 'modifyBundleConfigOpts',
            initialValue: {
                env,
                type,
                port,
                hot: process.env.HMR !== 'none',
                entry: {
                    umi: join(api.paths.absTmpPath, 'fes.js')
                },
                // @ts-ignore
                bundleImplementor,
                async modifyBabelOpts(opts) {
                    return api.applyPlugins({
                        type: api.ApplyPluginsType.modify,
                        key: 'modifyBabelOpts',
                        initialValue: opts
                    });
                },
                async modifyBabelPresetOpts(opts) {
                    return api.applyPlugins({
                        type: api.ApplyPluginsType.modify,
                        key: 'modifyBabelPresetOpts',
                        initialValue: opts
                    });
                },
                async chainWebpack(webpackConfig, opts) {
                    return api.applyPlugins({
                        type: api.ApplyPluginsType.modify,
                        key: 'chainWebpack',
                        initialValue: webpackConfig,
                        args: {
                            ...opts
                        }
                    });
                }
            },
            args: {
                ...bundlerArgs,
                type
            }
        });
        return api.applyPlugins({
            type: api.ApplyPluginsType.modify,
            key: 'modifyBundleConfig',
            initialValue: await bundler.getConfig(getConfigOpts),
            args: {
                ...bundlerArgs,
                type
            }
        });
    }

    const bundleConfigs = await api.applyPlugins({
        type: api.ApplyPluginsType.modify,
        key: 'modifyBundleConfigs',
        initialValue: [await getConfig({ type: 'csr' })].filter(
            Boolean,
        ),
        args: {
            ...bundlerArgs,
            getConfig
        }
    });

    return {
        bundleImplementor,
        bundler,
        bundleConfigs
    };
}

export function cleanTmpPathExceptCache({
    absTmpPath
}) {
    if (!existsSync(absTmpPath)) return;
    readdirSync(absTmpPath).forEach((file) => {
        if (file === '.cache') return;
        rimraf.sync(join(absTmpPath, file));
    });
}

// These sizes are pretty large. We'll warn for bundles exceeding them.
const WARN_AFTER_BUNDLE_GZIP_SIZE = 1.8 * 1024 * 1024;
const WARN_AFTER_CHUNK_GZIP_SIZE = 1 * 1024 * 1024;

export function printFileSizes(stats, dir) {
    const ui = require('cliui')({ width: 80 });
    const json = stats.toJson({
        hash: false,
        modules: false,
        chunks: false
    });

    const filesize = (bytes) => {
        bytes = Math.abs(bytes);
        const radix = 1024;
        const unit = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        let loop = 0;

        // calculate
        while (bytes >= radix) {
            bytes /= radix;
            ++loop;
        }
        return `${bytes.toFixed(1)} ${unit[loop]}`;
    };

    const assets = json.assets
        ? json.assets
        : json?.children?.reduce((acc, child) => acc.concat(child?.assets), []);

    const seenNames = new Map();
    const isJS = val => /\.js$/.test(val);
    const isCSS = val => /\.css$/.test(val);

    const orderedAssets = assets.map((a) => {
        a.name = a.name.split('?')[0];
        // These sizes are pretty large
        const isMainBundle = a.name.indexOf('fes.') === 0;
        const maxRecommendedSize = isMainBundle
            ? WARN_AFTER_BUNDLE_GZIP_SIZE
            : WARN_AFTER_CHUNK_GZIP_SIZE;
        const isLarge = maxRecommendedSize && a.size > maxRecommendedSize;
        return {
            ...a,
            suggested: isLarge && isJS(a.name)
        };
    })
        .filter((a) => {
            if (seenNames.has(a.name)) {
                return false;
            }
            seenNames.set(a.name, true);
            return isJS(a.name) || isCSS(a.name);
        })
        .sort((a, b) => {
            if (isJS(a.name) && isCSS(b.name)) return -1;
            if (isCSS(a.name) && isJS(b.name)) return 1;
            return b.size - a.size;
        });

    function getGzippedSize(asset) {
        const filepath = resolve(join(dir, asset.name));
        if (existsSync(filepath)) {
            const buffer = readFileSync(filepath);
            return filesize(zlib.gzipSync(buffer).length);
        }
        return filesize(0);
    }

    function makeRow(a, b, c) {
        return ` ${a}\t      ${b}\t ${c}`;
    }

    ui.div(
        `${makeRow(
            chalk.cyan.bold('File'),
            chalk.cyan.bold('Size'),
            chalk.cyan.bold('Gzipped'),
        )
        }\n\n${
            // eslint-disable-next-line
            orderedAssets.map(asset => makeRow(/js$/.test(asset.name) ? (asset.suggested ? chalk.yellow(join(dir, asset.name)) : chalk.green(join(dir, asset.name))) : chalk.blue(join(dir, asset.name)),
                filesize(asset.size),
                getGzippedSize(asset),))
                .join('\n')}`,
    );


    console.log(
        `${ui.toString()}\n\n  ${chalk.gray(
            'Images and other types of assets omitted.',
        )}\n`,
    );

    if (orderedAssets?.some(asset => asset.suggested)) {
    // We'll warn for bundles exceeding them.
    // TODO: use umi docs
        console.log();
        console.log(
            chalk.yellow('The bundle size is significantly larger than recommended.'),
        );
        console.log(
            chalk.yellow(
                'Consider reducing it with code splitting: https://umijs.org/docs/load-on-demand',
            ),
        );
        console.log(
            chalk.yellow(
                'You can also analyze the project dependencies using ANALYZE=1',
            ),
        );
        console.log();
    }
}
