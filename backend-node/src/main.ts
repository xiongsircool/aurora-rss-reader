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
import { scheduler } from './services/scheduler.js';

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
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Content-Type']
});

// Register multipart for file uploads
await app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  }
});

// Health check endpoint with database connectivity
app.get('/health', async () => {
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
});

// Initialize database on startup
try {
  initDatabase();
  console.log('✅ Database initialized');
  // Initialize Vector DB
  import('./services/vector.js').then(({ initVectorDB }) => {
    initVectorDB().then(() => console.log('✅ Vector DB initialized')).catch(e => console.error('❌ Vector DB init failed:', e));
  });
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
