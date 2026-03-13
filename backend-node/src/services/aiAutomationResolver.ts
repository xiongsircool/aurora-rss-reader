import { AIAutomationRuleRepository } from '../db/repositories/aiAutomationRule.js';
import { AIScopeType, AITaskKey } from '../db/models.js';
import { userSettingsService } from './userSettings.js';

export const AUTOMATION_TASK_KEYS: AITaskKey[] = [
  'entry_summary',
  'title_translation',
  'fulltext_translation',
  'aggregate_digest',
  'smart_tagging',
];

export const AUTOMATION_SCOPE_TYPES: AIScopeType[] = ['global', 'feed', 'group', 'tag'];

function getLegacyGlobalFallback(taskKey: AITaskKey): boolean {
  const settings = userSettingsService.getSettings();
  switch (taskKey) {
    case 'entry_summary':
      return !!settings.ai_auto_summary;
    case 'title_translation':
      return !!settings.ai_auto_title_translation;
    case 'smart_tagging':
      return !!settings.ai_auto_tagging;
    case 'aggregate_digest':
      return true;
    case 'fulltext_translation':
    default:
      return false;
  }
}

export class AIAutomationResolver {
  private repo = new AIAutomationRuleRepository();

  resolve(input: {
    taskKey: AITaskKey;
    scopeType: AIScopeType;
    scopeId?: string | null;
    feedId?: string | null;
    groupName?: string | null;
    tagId?: string | null;
  }): boolean {
    const scopes = this.buildCandidateScopes(input);
    for (const scope of scopes) {
      const match = this.repo.findByTaskAndScope(input.taskKey, scope.scopeType, scope.scopeId);
      if (!match || match.mode === 'inherit') {
        continue;
      }
      return match.mode === 'enabled';
    }
    return getLegacyGlobalFallback(input.taskKey);
  }

  listRules() {
    return this.repo.findAll();
  }

  private buildCandidateScopes(input: {
    scopeType: AIScopeType;
    scopeId?: string | null;
    feedId?: string | null;
    groupName?: string | null;
    tagId?: string | null;
  }) {
    const result: Array<{ scopeType: AIScopeType; scopeId: string | null }> = [];

    if (input.scopeType === 'feed') {
      if (input.feedId || input.scopeId) {
        result.push({ scopeType: 'feed', scopeId: input.feedId ?? input.scopeId ?? null });
      }
      if (input.groupName) {
        result.push({ scopeType: 'group', scopeId: input.groupName });
      }
      result.push({ scopeType: 'global', scopeId: null });
      return result;
    }

    if (input.scopeType === 'group') {
      if (input.groupName || input.scopeId) {
        result.push({ scopeType: 'group', scopeId: input.groupName ?? input.scopeId ?? null });
      }
      result.push({ scopeType: 'global', scopeId: null });
      return result;
    }

    if (input.scopeType === 'tag') {
      if (input.tagId || input.scopeId) {
        result.push({ scopeType: 'tag', scopeId: input.tagId ?? input.scopeId ?? null });
      }
      result.push({ scopeType: 'global', scopeId: null });
      return result;
    }

    result.push({ scopeType: 'global', scopeId: null });
    return result;
  }
}

export const aiAutomationResolver = new AIAutomationResolver();
