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

推荐工具:
- list_feeds / get_feed / create_feed / update_feed / delete_feed / refresh_feed
- list_entries / get_entry / update_entry / batch_update_entries
- search_entries (keyword / semantic / hybrid)
- get_reader_overview
- get_summary_queue_status

兼容别名:
- query_entries
- search
- manage_feeds
- batch_update
- get_overview`
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
