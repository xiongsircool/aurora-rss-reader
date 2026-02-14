import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { getConfig } from './config/index.js';
import { initDatabase } from './db/init.js';
import { userSettingsRoutes } from './routes/userSettings.js';
import { feedsRoutes } from './routes/feeds.js';
import { entriesRoutes } from './routes/entries.js';
import { aiRoutes } from './routes/ai.js';
import { opmlRoutes } from './routes/opml.js';
import { iconsRoutes } from './routes/icons.js';
import { schedulerRoutes } from './routes/scheduler.js';
import { zoteroRoutes } from './routes/zotero.js';
import { collectionsRoutes } from './routes/collections.js';
import tagsRoutes from './routes/tags.js';
import { scheduler } from './services/scheduler.js';
import { handleMcpRequest, handleMcpGetRequest, handleMcpDeleteRequest } from './mcp/server.js';

const app = Fastify({
  logger: true
});

// CORS configuration
await app.register(cors, {
  origin: (origin, cb) => {
    // Allow all localhost origins in development
    if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      cb(null, true);
      return;
    }
    // Allow Electron origins
    if (origin === 'null' || origin.startsWith('app://')) {
      cb(null, true);
      return;
    }
    cb(new Error('Not allowed'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Mcp-Session-Id'],
  exposedHeaders: ['Content-Type', 'Mcp-Session-Id']
});

// Register multipart for file uploads
await app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  }
});

async function healthCheck() {
  let dbStatus = 'ok';
  let dbError = null;

  try {
    const { getDatabase } = await import('./db/session.js');
    const db = getDatabase();
    db.prepare('SELECT 1').get();
  } catch (error) {
    dbStatus = 'error';
    dbError = error instanceof Error ? error.message : String(error);
  }

  return {
    status: dbStatus === 'ok' ? 'ok' : 'degraded',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: dbStatus,
      error: dbError,
    },
  };
}

// Health check endpoint with database connectivity
app.get('/health', async () => healthCheck());
app.get('/api/health', async () => healthCheck());

// Initialize database on startup
try {
  initDatabase();
  console.log('✅ Database initialized');
  console.log('✅ Vector DB initialized (sqlite-vss)');
} catch (error) {
  console.error('❌ Database initialization failed:', error);
  process.exit(1);
}

// Start background scheduler
scheduler.start();

// Register API routes with /api prefix
await app.register(userSettingsRoutes, { prefix: '/api' });
await app.register(feedsRoutes, { prefix: '/api' });
await app.register(entriesRoutes, { prefix: '/api' });
await app.register(aiRoutes, { prefix: '/api' });
await app.register(opmlRoutes, { prefix: '/api' });
await app.register(iconsRoutes, { prefix: '/api' });
await app.register(schedulerRoutes, { prefix: '/api' });
await app.register(zoteroRoutes, { prefix: '/api' });
await app.register(collectionsRoutes, { prefix: '/api' });
await app.register(tagsRoutes, { prefix: '/api' });

// ============================================
// MCP (Model Context Protocol) Endpoint
// Provides AI-accessible API via Streamable HTTP
// ============================================

// POST /mcp - Send JSON-RPC messages to MCP server
app.post('/mcp', {
  config: {
    // Disable body parsing - MCP transport handles it
    rawBody: true,
  },
}, async (request, reply) => {
  // Use raw Node.js objects for MCP transport compatibility
  await handleMcpRequest(request.raw, reply.raw, request.body);
  // Prevent Fastify from sending response (MCP transport handles it)
  reply.hijack();
});

// GET /mcp - SSE connection for server-to-client messages
app.get('/mcp', async (request, reply) => {
  await handleMcpGetRequest(request.raw, reply.raw);
  reply.hijack();
});

// DELETE /mcp - Close MCP session
app.delete('/mcp', async (request, reply) => {
  await handleMcpDeleteRequest(request.raw, reply.raw);
  reply.hijack();
});

console.log('✅ MCP endpoint registered at /mcp');

const config = getConfig();

app.listen({ port: config.apiPort, host: config.apiHost }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 Server listening at ${address}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  scheduler.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  scheduler.stop();
  process.exit(0);
});
