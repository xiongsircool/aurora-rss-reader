
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

1. **list_feeds / get_feed / create_feed / update_feed / delete_feed / refresh_feed**
   - 订阅管理工具，按资源拆分，适合智能体精确调用

2. **list_entries / get_entry / update_entry / batch_update_entries**
   - 文章查询与状态更新
   - 支持 date_range + time_field + cursor

3. **search_entries**
   - 支持 keyword / semantic / hybrid 三种检索模式

4. **get_reader_overview**
   - 获取全局、订阅、分组统计概览

5. **get_summary_queue_status**
   - 查看后台摘要队列、扫描范围与运行状态

## 兼容说明

- 仍保留 query_entries / search / manage_feeds / batch_update / get_overview 作为兼容别名
- 新调用请优先使用拆分后的资源型工具

## 使用示例

- "帮我看看最近 24 小时 AI 分组有什么新闻" → list_entries(group_name="AI", date_range="24h")
- "搜索关于 AI 的文章" → search_entries(query="AI", mode="hybrid")
- "把最近 7 天这个分组的未读标记为已读，先预览" → batch_update_entries(action="mark_read", group_name="...", status="unread", date_range="7d", dry_run=true)
- "订阅这个网站" → create_feed(url="...")
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
