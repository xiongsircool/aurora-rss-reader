/**
 * Collections API Routes
 */

import { FastifyInstance } from 'fastify';
import { CollectionRepository, EntryRepository } from '../db/repositories/index.js';

export async function collectionsRoutes(app: FastifyInstance) {
  const collectionRepo = new CollectionRepository();
  const entryRepo = new EntryRepository();

  // GET /collections - List all collections with entry counts
  app.get('/collections', async () => {
    const collections = collectionRepo.findAll();
    return collections.map(c => ({
      ...c,
      entry_count: collectionRepo.getEntryCountInCollection(c.id),
    }));
  });

  // POST /collections - Create a new collection
  app.post('/collections', async (request, reply) => {
    const body = request.body as { name: string; icon?: string; color?: string };
    if (!body.name?.trim()) {
      return reply.status(400).send({ error: 'Name is required' });
    }
    const collection = collectionRepo.create({
      name: body.name.trim(),
      icon: body.icon,
      color: body.color,
    });
    return collection;
  });

  // GET /collections/:id - Get a single collection
  app.get('/collections/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const collection = collectionRepo.findById(id);
    if (!collection) {
      return reply.status(404).send({ error: 'Collection not found' });
    }
    return {
      ...collection,
      entry_count: collectionRepo.getEntryCountInCollection(id),
    };
  });

  // PUT /collections/:id - Update a collection
  app.put('/collections/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { name?: string; icon?: string; color?: string; sort_order?: number };
    const updated = collectionRepo.update(id, body);
    if (!updated) {
      return reply.status(404).send({ error: 'Collection not found' });
    }
    return updated;
  });

  // DELETE /collections/:id - Delete a collection
  app.delete('/collections/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = collectionRepo.delete(id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Collection not found' });
    }
    return { success: true };
  });

  // === Collection Entries ===

  // GET /collections/:id/entries - Get entries in a collection
  app.get('/collections/:id/entries', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { limit?: string; offset?: string };

    const collection = collectionRepo.findById(id);
    if (!collection) {
      return reply.status(404).send({ error: 'Collection not found' });
    }

    const limit = parseInt(query.limit || '100', 10);
    const offset = parseInt(query.offset || '0', 10);
    const collectionEntries = collectionRepo.getEntriesInCollection(id, limit, offset);

    // Get full entry details
    const entries = collectionEntries.map(ce => {
      const entry = entryRepo.findById(ce.entry_id);
      return entry ? { ...entry, added_at: ce.added_at, note: ce.note } : null;
    }).filter(Boolean);

    return entries;
  });

  // POST /collections/:id/entries - Add entry to collection
  app.post('/collections/:id/entries', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { entry_id: string; note?: string };

    if (!body.entry_id) {
      return reply.status(400).send({ error: 'entry_id is required' });
    }

    const collection = collectionRepo.findById(id);
    if (!collection) {
      return reply.status(404).send({ error: 'Collection not found' });
    }

    const entry = entryRepo.findById(body.entry_id);
    if (!entry) {
      return reply.status(404).send({ error: 'Entry not found' });
    }

    const result = collectionRepo.addEntry({
      collection_id: id,
      entry_id: body.entry_id,
      note: body.note,
    });
    return result;
  });

  // DELETE /collections/:id/entries/:entryId - Remove entry from collection
  app.delete('/collections/:id/entries/:entryId', async (request, reply) => {
    const { id, entryId } = request.params as { id: string; entryId: string };
    const removed = collectionRepo.removeEntry(id, entryId);
    if (!removed) {
      return reply.status(404).send({ error: 'Entry not in collection' });
    }
    return { success: true };
  });

  // GET /entries/:id/collections - Get collections for an entry
  app.get('/entries/:id/collections', async (request) => {
    const { id } = request.params as { id: string };
    return collectionRepo.getCollectionsForEntry(id);
  });
}
