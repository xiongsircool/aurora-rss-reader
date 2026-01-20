declare module 'vue-virtual-scroller' {
    import type { Plugin } from 'vue'
    const component: Plugin
    export default component

    export const RecycleScroller: any
    export const DynamicScroller: any
    export const DynamicScrollerItem: any
}
