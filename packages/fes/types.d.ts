// @ts-ignore
import '@@/configType';

export * from '@fesjs/runtime';

export interface RouteMeta {
    name?: string;
    title?: string;
    layout?: boolean | { sidebar?: boolean; header?: boolean; logo?: boolean };
}

export interface PluginRuntimeConfig {}

export interface PluginBuildConfig {}

export declare function defineRouteMeta(routeMeta: RouteMeta): RouteMeta;

export declare function defineBuildConfig(config: PluginBuildConfig ): PluginBuildConfig;

export declare function defineRuntimeConfig(config:  PluginRuntimeConfig):  PluginRuntimeConfig;

