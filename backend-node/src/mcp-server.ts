/**
 * MCP Server Standalone Entry Point (stdio mode)
 * 
 * This is an alternative entry point for running the MCP server
 * as a standalone process using stdio transport.
 * 
 * For HTTP mode, use the /mcp endpoint in main.ts
 * 
 * Usage: npm run mcp
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initDatabase } from "./db/init.js";
import { registerAllTools } from "./mcp/tools/index.js";

async function main() {
  try {
    // Initialize database
    initDatabase();
    console.log("✅ Database initialized");

    // Create MCP server
    const server = new McpServer({
      name: "Aurora RSS Reader",
      version: "1.0.0",
    }, {
      instructions: `Aurora RSS Reader - AI 可访问的 RSS 订阅管理服务

可用工具:
- query_entries: 查询文章（支持状态、时间、关键词过滤）
- search: 智能搜索（关键词或语义）
- manage_feeds: 订阅管理（增删改查刷新）
- batch_update: 批量操作（已读、收藏）
- get_overview: 获取统计概览`
    });

    // Register all tools
    registerAllTools(server);

    // Connect via stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.log("🚀 Aurora MCP Server running on stdio");
  } catch (error: unknown) {
    console.error("❌ Failed to start MCP server:", error);
    process.exit(1);
  }
}

main();
