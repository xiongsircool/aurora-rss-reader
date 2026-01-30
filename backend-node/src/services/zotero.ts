/**
 * Zotero Connector 服务
 * 通过本地 HTTP API 与 Zotero 桌面端通信
 */

const ZOTERO_CONNECTOR_URL = 'http://127.0.0.1:23119';

// 学术出版商域名列表
const ACADEMIC_DOMAINS = [
  'nature.com', 'science.org', 'springer.com', 'sciencedirect.com',
  'wiley.com', 'tandfonline.com', 'arxiv.org', 'pubmed.ncbi.nlm.nih.gov',
  'ieee.org', 'acm.org', 'aps.org', 'cell.com', 'pnas.org',
  'plos.org', 'frontiersin.org', 'mdpi.com', 'biorxiv.org',
  'medrxiv.org', 'ssrn.com', 'researchgate.net', 'academia.edu',
  'doi.org', 'dx.doi.org', 'jstor.org', 'sagepub.com',
  'ncbi.nlm.nih.gov', 'nih.gov', 'biomedcentral.com', 'bmj.com',
  'thelancet.com', 'nejm.org', 'jamanetwork.com', 'oup.com', 'cambridge.org',
];

// 出版商 DOI 前缀映射 (用于从 URL 构建 DOI)
const PUBLISHER_DOI_PREFIXES: Record<string, string> = {
  'nature.com': '10.1038',
  'science.org': '10.1126',
  'cell.com': '10.1016',
  'pnas.org': '10.1073',
  'aps.org': '10.1103',
  'springer.com': '10.1007',
  'wiley.com': '10.1002',
  'plos.org': '10.1371',
  'frontiersin.org': '10.3389',
  'mdpi.com': '10.3390',
  'biorxiv.org': '10.1101',
  'medrxiv.org': '10.1101',
  'bmj.com': '10.1136',
  'thelancet.com': '10.1016',
  'nejm.org': '10.1056',
};

export interface ZoteroSaveResult {
  success: boolean;
  message: string;
}

export interface ZoteroItemParams {
  url: string;
  title: string;
  author?: string | null;
  summary?: string | null;
  content?: string | null;
  publishedAt?: string | null;
  feedTitle?: string | null;
  doi?: string | null;
}

export class ZoteroService {
  /**
   * 检测 Zotero 是否正在运行
   */
  async isRunning(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const response = await fetch(`${ZOTERO_CONNECTOR_URL}/connector/ping`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 检测 URL 是否为学术来源
   */
  isAcademicUrl(url: string): boolean {
    const lowerUrl = url.toLowerCase();
    return ACADEMIC_DOMAINS.some(domain => lowerUrl.includes(domain));
  }

  /**
   * 从多个来源提取 DOI (URL、content、summary)
   */
  extractDOI(url: string, content?: string | null, summary?: string | null): string | null {
    // 1. 直接从 URL 匹配标准 DOI 格式
    const doiMatch = url.match(/10\.\d{4,}\/[^\s&?#]+/);
    if (doiMatch) return doiMatch[0];

    // 2. 从 doi.org URL 提取
    const doiOrgMatch = url.match(/doi\.org\/(10\.\d{4,}\/[^\s&?#]+)/);
    if (doiOrgMatch) return doiOrgMatch[1];

    // 3. 从出版商 URL 构建 DOI (如 nature.com/articles/s41467-026-68882-7)
    for (const [domain, prefix] of Object.entries(PUBLISHER_DOI_PREFIXES)) {
      if (url.includes(domain)) {
        const articleMatch = url.match(/articles?\/(s?\d+[-\w.]+)/i);
        if (articleMatch) {
          return `${prefix}/${articleMatch[1]}`;
        }
      }
    }

    // 4. 从 content/summary 中提取 DOI
    const textToSearch = [content, summary].filter(Boolean).join(' ');
    if (textToSearch) {
      // 匹配 doi:10.xxxx/xxx 或 https://doi.org/10.xxxx/xxx
      const contentDoiMatch = textToSearch.match(/(?:doi[:\s]*|doi\.org\/)(10\.\d{4,}\/[^\s<>"&]+)/i);
      if (contentDoiMatch) return contentDoiMatch[1];
    }

    return null;
  }

  /**
   * 从 URL 提取 PubMed ID
   */
  extractPMID(url: string): string | null {
    // pubmed.ncbi.nlm.nih.gov/12345678/
    const pmidMatch = url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/);
    if (pmidMatch) return pmidMatch[1];

    // ncbi.nlm.nih.gov/pubmed/12345678
    const ncbiMatch = url.match(/ncbi\.nlm\.nih\.gov\/pubmed\/(\d+)/);
    if (ncbiMatch) return ncbiMatch[1];

    return null;
  }

  /**
   * 从 URL 提取 arXiv ID
   */
  extractArxivId(url: string): string | null {
    // arxiv.org/abs/2401.12345 or arxiv.org/pdf/2401.12345
    const arxivMatch = url.match(/arxiv\.org\/(?:abs|pdf)\/(\d+\.\d+)/);
    return arxivMatch ? arxivMatch[1] : null;
  }

  /**
   * 解析作者字符串为 Zotero creators 格式
   */
  parseAuthors(authorStr: string | null | undefined): Array<{
    creatorType: string;
    firstName?: string;
    lastName?: string;
    name?: string;
  }> {
    if (!authorStr) return [];

    // 分割多个作者 (逗号、分号、and)
    const authors = authorStr.split(/[,;]|\s+and\s+/i).map(a => a.trim()).filter(Boolean);

    return authors.map(author => {
      const parts = author.split(/\s+/);
      if (parts.length >= 2) {
        return {
          creatorType: 'author',
          firstName: parts.slice(0, -1).join(' '),
          lastName: parts[parts.length - 1],
        };
      }
      return { creatorType: 'author', name: author };
    });
  }

  /**
   * 构建 Zotero item 对象
   */
  buildZoteroItem(params: ZoteroItemParams): Record<string, unknown> {
    const isAcademic = this.isAcademicUrl(params.url);
    // 优先使用传入的 DOI，否则尝试从 URL 提取
    const doi = params.doi || this.extractDOI(params.url, params.content, params.summary);
    const pmid = this.extractPMID(params.url);
    const arxivId = this.extractArxivId(params.url);

    // 基础 item
    const item: Record<string, unknown> = {
      itemType: isAcademic ? 'journalArticle' : 'webpage',
      title: params.title || 'Untitled',
      url: params.url,
      accessDate: new Date().toISOString(),
    };

    // 添加作者
    const creators = this.parseAuthors(params.author);
    if (creators.length > 0) {
      item.creators = creators;
    }

    // 添加摘要 (清理 HTML)
    if (params.summary) {
      const cleanSummary = params.summary.replace(/<[^>]*>/g, '').trim();
      if (cleanSummary) {
        item.abstractNote = cleanSummary;
      }
    }

    // 添加发布日期
    if (params.publishedAt) {
      item.date = params.publishedAt.split('T')[0];
    }

    // 学术文献特有字段
    if (isAcademic) {
      if (doi) {
        item.DOI = doi;
      }
      if (pmid) {
        // Zotero 使用 extra 字段存储 PMID
        item.extra = `PMID: ${pmid}`;
      }
      if (arxivId) {
        item.extra = item.extra ? `${item.extra}\narXiv: ${arxivId}` : `arXiv: ${arxivId}`;
      }
      if (params.feedTitle) {
        item.publicationTitle = params.feedTitle;
      }
    } else {
      if (params.feedTitle) {
        item.websiteTitle = params.feedTitle;
      }
    }

    return item;
  }

  /**
   * 发送文章到 Zotero (使用 saveItems API)
   */
  async saveItem(params: ZoteroItemParams): Promise<ZoteroSaveResult> {
    const isRunning = await this.isRunning();
    if (!isRunning) {
      return {
        success: false,
        message: 'Zotero 未运行，请先启动 Zotero 桌面端',
      };
    }

    try {
      const item = this.buildZoteroItem(params);
      const sessionID = crypto.randomUUID();

      const response = await fetch(`${ZOTERO_CONNECTOR_URL}/connector/saveItems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [item],
          uri: params.url,
          sessionID,
        }),
      });

      if (response.ok) {
        const itemType = item.itemType === 'journalArticle' ? '文献' : '网页';
        const doi = item.DOI ? ` (DOI: ${item.DOI})` : '';
        return {
          success: true,
          message: `已保存为${itemType}到 Zotero${doi}`,
        };
      } else {
        const text = await response.text();
        return {
          success: false,
          message: `发送失败: ${text || response.statusText}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `发送失败: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }
}

export const zoteroService = new ZoteroService();
