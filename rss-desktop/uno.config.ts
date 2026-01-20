import { defineConfig, presetUno, presetIcons, presetAttributify } from 'unocss'

export default defineConfig({
    presets: [
        presetUno(),
        presetIcons(),
        presetAttributify(),
    ],
    theme: {
        breakpoints: {
            'sm': '640px',
            'md': '960px',
            'lg': '1024px',
            'xl': '1280px',
            '2xl': '1536px',
        },
    },
    // Custom rules for complex responsive patterns
    rules: [
        // Full width utility for responsive stacking
        ['w-full-stack', { width: '100% !important', 'max-width': 'none !important' }],
    ],
})
