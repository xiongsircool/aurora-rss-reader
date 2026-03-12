import { FastifyInstance } from 'fastify';
import { zoteroService } from '../services/zotero.js';
import { getObjectBody } from '../utils/http.js';

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
  }>('/zotero/save', async (request, reply) => {
    const body = getObjectBody(request.body);
    if (!body) {
      return reply.code(400).send({ success: false, message: '请求体必须是对象' });
    }

    const url = typeof body.url === 'string' ? body.url : '';
    const title = typeof body.title === 'string' ? body.title : '';
    const author = typeof body.author === 'string' ? body.author : undefined;
    const summary = typeof body.summary === 'string' ? body.summary : undefined;
    const publishedAt = typeof body.publishedAt === 'string' ? body.publishedAt : undefined;
    const feedTitle = typeof body.feedTitle === 'string' ? body.feedTitle : undefined;
    const doi = typeof body.doi === 'string' ? body.doi : undefined;

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
