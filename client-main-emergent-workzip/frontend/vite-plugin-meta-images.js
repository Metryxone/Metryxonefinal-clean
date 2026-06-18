"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metaImagesPlugin = metaImagesPlugin;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Vite plugin that updates og:image and twitter:image meta tags
 * to point to the app's opengraph image with the correct Replit domain.
 */
function metaImagesPlugin() {
    return {
        name: 'vite-plugin-meta-images',
        transformIndexHtml(html) {
            const baseUrl = getDeploymentUrl();
            if (!baseUrl) {
                log('[meta-images] no Replit deployment domain found, skipping meta tag updates');
                return html;
            }
            // Check if opengraph image exists in public directory
            const publicDir = path_1.default.resolve(process.cwd(), 'client', 'public');
            const opengraphPngPath = path_1.default.join(publicDir, 'opengraph.png');
            const opengraphJpgPath = path_1.default.join(publicDir, 'opengraph.jpg');
            const opengraphJpegPath = path_1.default.join(publicDir, 'opengraph.jpeg');
            let imageExt = null;
            if (fs_1.default.existsSync(opengraphPngPath)) {
                imageExt = 'png';
            }
            else if (fs_1.default.existsSync(opengraphJpgPath)) {
                imageExt = 'jpg';
            }
            else if (fs_1.default.existsSync(opengraphJpegPath)) {
                imageExt = 'jpeg';
            }
            if (!imageExt) {
                log('[meta-images] OpenGraph image not found, skipping meta tag updates');
                return html;
            }
            const imageUrl = `${baseUrl}/opengraph.${imageExt}`;
            log('[meta-images] updating meta image tags to:', imageUrl);
            html = html.replace(/<meta\s+property="og:image"\s+content="[^"]*"\s*\/>/g, `<meta property="og:image" content="${imageUrl}" />`);
            html = html.replace(/<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/>/g, `<meta name="twitter:image" content="${imageUrl}" />`);
            return html;
        },
    };
}
function getDeploymentUrl() {
    if (process.env.REPLIT_INTERNAL_APP_DOMAIN) {
        const url = `https://${process.env.REPLIT_INTERNAL_APP_DOMAIN}`;
        log('[meta-images] using internal app domain:', url);
        return url;
    }
    if (process.env.REPLIT_DEV_DOMAIN) {
        const url = `https://${process.env.REPLIT_DEV_DOMAIN}`;
        log('[meta-images] using dev domain:', url);
        return url;
    }
    return null;
}
function log(...args) {
    if (process.env.NODE_ENV === 'production') {
        console.log(...args);
    }
}
