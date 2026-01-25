/**
 * Scheduler API Routes
 */

import { FastifyInstance } from 'fastify';
import { scheduler } from '../services/scheduler.js';

export async function schedulerRoutes(app: FastifyInstance) {
  // GET /scheduler/status - Get scheduler status
  app.get('/scheduler/status', async () => {
    return scheduler.getStatus();
  });

  // POST /scheduler/start - Start the scheduler
  app.post('/scheduler/start', async () => {
    scheduler.start();
    return { success: true, message: 'Scheduler started' };
  });

  // POST /scheduler/stop - Stop the scheduler
  app.post('/scheduler/stop', async () => {
    scheduler.stop();
    return { success: true, message: 'Scheduler stopped' };
  });

  // POST /scheduler/trigger - Manually trigger a refresh
  app.post('/scheduler/trigger', async () => {
    await scheduler.triggerRefresh();
    return { success: true, message: 'Refresh triggered' };
  });
}
