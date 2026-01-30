import { FastifyInstance } from 'fastify';
import { zoteroService } from '../services/zotero.js';

export async function zoteroRoutes(app: FastifyInstance) {
  // 检测 Zotero 是否运行
  app.get('/zotero/status', async () => {
    const isRunning = await zoteroService.isRunning();
    return { running: isRunning };
  });

  // 发送文章到 Zotero
  app.post<{
    Body: {
      url: string;
      title: string;
      author?: string;
      summary?: string;
      publishedAt?: string;
      feedTitle?: string;
      doi?: string;
    };
  }>('/zotero/save', async (request) => {
    const { url, title, author, summary, publishedAt, feedTitle, doi } = request.body;

    if (!url || !title) {
      return { success: false, message: '缺少必要参数' };
    }

    return await zoteroService.saveItem({
      url,
      title,
      author,
      summary,
      publishedAt,
      feedTitle,
      doi,
    });
  });
}
