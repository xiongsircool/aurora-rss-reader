/**
 * Default RSSHub mirror configuration
 */

export interface RSSHubMirror {
  name: string;
  base_url: string;
  priority: number;
  is_default?: boolean;
  description: string;
}

const DEFAULT_RSSHUB_MIRRORS: RSSHubMirror[] = [
  {
    name: '主镜像',
    base_url: 'https://rsshub.rssforever.com',
    priority: 1,
    is_default: true,
    description: '公开镜像，当前实测可返回 RSS 路由',
  },
  {
    name: '备用镜像1',
    base_url: 'https://rsshub.ktachibana.party',
    priority: 2,
    description: '公开镜像，当前实测可返回 RSS 路由',
  },
];

export function getDefaultRSSHubMirrors(): RSSHubMirror[] {
  return JSON.parse(JSON.stringify(DEFAULT_RSSHUB_MIRRORS));
}

export function getDefaultRSSHubBaseUrls(): string[] {
  return DEFAULT_RSSHUB_MIRRORS.map(mirror => mirror.base_url);
}
