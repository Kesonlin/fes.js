// .fes.js 只负责管理编译时配置，只能使用plain Object


export default {
    base: '',
    define: {
        __DEV__: false
    },
    publicPath: '/',
    access: {
        roles: {
            admin: ["/", "/onepiece"]
        }
    },
    layout: {
        title: "Fes.js",
        footer: 'Created by MumbelFe',
        multiTabs: false,
        menus: [{
            name: 'index'
        }, {
            name: 'onepiece'
        }]
    },
    locale: {
        legacy: true
    },
    devServer: {
        port: 8000
    },
    enums: {
        status: [['0', '无效的'], ['1', '有效的']]
    }
};
