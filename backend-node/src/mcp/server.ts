
import { randomUUID } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { registerAllTools } from "./tools/index.js";

// Store transports by session ID for stateful connections
const transports: Record<string, StreamableHTTPServerTransport> = {};

/**
 * Create and configure the MCP Server with all tools registered
 */
function createMCPServer(): McpServer {
    const server = new McpServer({
        name: "Aurora RSS Reader",
        version: "1.0.0",
    }, {
        instructions: `
Aurora RSS Reader MCP 服务 - 让 AI 管理您的 RSS 订阅

## 可用功能

1. **query_entries** - 查询文章
   - 按状态（未读/已读/收藏）、时间、订阅源过滤
   - 支持关键词搜索
   - 可返回文章内容

2. **search** - 智能搜索
   - keyword: 关键词匹配
   - semantic: 语义相似性搜索（需配置 embedding）

3. **manage_feeds** - 订阅管理
   - 查看、添加、更新、删除、刷新订阅

4. **batch_update** - 批量操作
   - 标记已读/未读、收藏

5. **get_overview** - 获取概览统计

## 使用示例

- "帮我看看今天有什么新闻" → query_entries(dateRange="today")
- "搜索关于 AI 的文章" → search(query="AI", type="semantic")  
- "把所有未读标记为已读" → batch_update(action="mark_read", filter={status="unread"})
- "订阅这个网站" → manage_feeds(action="add", url="...")
`.trim()
    });

    // Register all tools
    registerAllTools(server);

    return server;
}

/**
 * Handle MCP POST requests via HTTP
 */
export async function handleMcpRequest(
    req: IncomingMessage & { auth?: any },
    res: ServerResponse,
    parsedBody?: unknown
): Promise<void> {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    try {
        let transport: StreamableHTTPServerTransport;

        if (sessionId && transports[sessionId]) {
            transport = transports[sessionId];
        } else if (!sessionId && isInitializeRequest(parsedBody)) {
            transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: (newSessionId) => {
                    console.log(`[MCP] Session initialized: ${newSessionId}`);
                    transports[newSessionId] = transport;
                }
            });

            transport.onclose = () => {
                const sid = transport.sessionId;
                if (sid && transports[sid]) {
                    console.log(`[MCP] Session closed: ${sid}`);
                    delete transports[sid];
                }
            };

            const server = createMCPServer();
            await server.connect(transport);
            await transport.handleRequest(req, res, parsedBody);
            return;
        } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                jsonrpc: '2.0',
                error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
                id: null
            }));
            return;
        }

        await transport.handleRequest(req, res, parsedBody);
    } catch (error) {
        console.error('[MCP] Error handling request:', error);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                jsonrpc: '2.0',
                error: { code: -32603, message: 'Internal server error' },
                id: null
            }));
        }
    }
}

/**
 * Handle MCP GET requests (for SSE connections)
 */
export async function handleMcpGetRequest(
    req: IncomingMessage,
    res: ServerResponse
): Promise<void> {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (!sessionId || !transports[sessionId]) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid or missing session ID' }));
        return;
    }

    await transports[sessionId].handleRequest(req, res);
}

/**
 * Handle MCP DELETE requests (to close session)
 */
export async function handleMcpDeleteRequest(
    req: IncomingMessage,
    res: ServerResponse
): Promise<void> {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (!sessionId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Session ID required' }));
        return;
    }

    const transport = transports[sessionId];
    if (transport) {
        await transport.close();
        delete transports[sessionId];
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
}
