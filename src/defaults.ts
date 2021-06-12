import { WorkspaceOptions } from './types';

export function getDefaultOptions(): WorkspaceOptions {
    return {
        isProduction: process.env.NODE_ENV === 'production',
        title: '👻',
        description: '',
        charset: 'utf-8',
        lang: 'en',
        favicon: '/favicon.ico',
        themeColor: '#fff',
        cssLinks: [],
        stylesheets: [
            'index.css'
        ]
    };
}
