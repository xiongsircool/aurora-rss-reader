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
    name: '主镜像 (官方)',
    base_url: 'https://rsshub.app',
    priority: 1,
    is_default: true,
    description: 'RSSHub官方镜像',
  },
  {
    name: '备用镜像1',
    base_url: 'https://rsshub.rssforever.com',
    priority: 2,
    description: 'RSSHub备用镜像1',
  },
  {
    name: '备用镜像2',
    base_url: 'https://rsshub.ktachibana.party',
    priority: 3,
    description: 'RSSHub备用镜像2',
  },
  {
    name: '备用镜像3',
    base_url: 'https://rsshub.cskaoyan.com',
    priority: 4,
    description: 'RSSHub备用镜像3',
  },
];

export function getDefaultRSSHubMirrors(): RSSHubMirror[] {
  return JSON.parse(JSON.stringify(DEFAULT_RSSHUB_MIRRORS));
}

export function getDefaultRSSHubBaseUrls(): string[] {
  return DEFAULT_RSSHUB_MIRRORS.map(mirror => mirror.base_url);
}
