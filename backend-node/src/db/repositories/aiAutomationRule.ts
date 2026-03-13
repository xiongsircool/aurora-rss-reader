import { getDatabase } from '../session.js';
import {
  AIAutomationMode,
  AIAutomationRule,
  AIScopeType,
  AITaskKey,
  generateId,
} from '../models.js';

export interface AIAutomationRuleCreateInput {
  task_key: AITaskKey;
  scope_type: AIScopeType;
  scope_id?: string | null;
  mode: AIAutomationMode;
}

export interface AIAutomationRuleUpdateInput {
  mode: AIAutomationMode;
}

export class AIAutomationRuleRepository {
  private db = getDatabase();

  create(input: AIAutomationRuleCreateInput): AIAutomationRule {
    const now = new Date().toISOString();
    const rule: AIAutomationRule = {
      id: generateId(),
      task_key: input.task_key,
      scope_type: input.scope_type,
      scope_id: input.scope_id ?? null,
      mode: input.mode,
      created_at: now,
      updated_at: now,
    };

    this.db.prepare(`
      INSERT INTO ai_automation_rules (
        id, task_key, scope_type, scope_id, mode, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      rule.id,
      rule.task_key,
      rule.scope_type,
      rule.scope_id,
      rule.mode,
      rule.created_at,
      rule.updated_at,
    );

    return rule;
  }

  findAll(): AIAutomationRule[] {
    return this.db
      .prepare(`
        SELECT * FROM ai_automation_rules
        ORDER BY task_key ASC, scope_type ASC, COALESCE(scope_id, '') ASC, created_at ASC
      `)
      .all() as AIAutomationRule[];
  }

  findByTaskAndScope(
    taskKey: AITaskKey,
    scopeType: AIScopeType,
    scopeId?: string | null,
  ): AIAutomationRule | null {
    const row = this.db.prepare(`
      SELECT * FROM ai_automation_rules
      WHERE task_key = ? AND scope_type = ? AND (
        (scope_id IS NULL AND ? IS NULL) OR scope_id = ?
      )
      LIMIT 1
    `).get(taskKey, scopeType, scopeId ?? null, scopeId ?? null) as AIAutomationRule | undefined;

    return row ?? null;
  }

  upsert(input: AIAutomationRuleCreateInput): AIAutomationRule {
    const existing = this.findByTaskAndScope(input.task_key, input.scope_type, input.scope_id);
    if (!existing) {
      return this.create(input);
    }

    const updated: AIAutomationRule = {
      ...existing,
      mode: input.mode,
      updated_at: new Date().toISOString(),
    };

    this.db.prepare(`
      UPDATE ai_automation_rules
      SET mode = ?, updated_at = ?
      WHERE id = ?
    `).run(updated.mode, updated.updated_at, updated.id);

    return updated;
  }

  deleteByTaskAndScope(taskKey: AITaskKey, scopeType: AIScopeType, scopeId?: string | null): boolean {
    const result = this.db.prepare(`
      DELETE FROM ai_automation_rules
      WHERE task_key = ? AND scope_type = ? AND (
        (scope_id IS NULL AND ? IS NULL) OR scope_id = ?
      )
    `).run(taskKey, scopeType, scopeId ?? null, scopeId ?? null);

    return result.changes > 0;
  }
}
