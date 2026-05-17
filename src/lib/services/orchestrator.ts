import { githubClient } from '@/lib/github/client';
import { webhookHandler } from '@/lib/webhooks/handler';
import { aiAnalyzer } from '@/lib/ai/analyzer';
import { databaseClient } from '@/lib/database/client';
import { GitHubWebhookPayload, AIAnalysisRequest } from '@/types';
import { createResponse } from '@/lib/utils';

/**
 * Service Orchestrator
 * Coordinates between different services and layers
 */
export class ServiceOrchestrator {
  /**
   * Process incoming webhook and trigger analysis
   */
  async processWebhookWithAnalysis(
    eventType: string,
    payload: GitHubWebhookPayload
  ) {
    try {
      // Save webhook event to database
      await databaseClient.saveWebhookEvent({
        event_type: eventType,
        payload,
        processed: false,
      });

      // Process webhook
      await webhookHandler.processEvent(eventType, payload);

      // Trigger AI analysis if needed
      if (eventType === 'pull_request') {
        const analysisRequest: AIAnalysisRequest = {
          type: 'code_review',
          content: 'Pull request content',
          context: { repository: payload.repository.full_name },
        };

        const analysis = await aiAnalyzer.analyze(analysisRequest);
        console.log('AI Analysis completed:', analysis);
      }

      return createResponse(true, { message: 'Webhook processed successfully' });
    } catch (error) {
      console.error('Error processing webhook:', error);
      return createResponse(false, undefined, (error as Error).message);
    }
  }

  /**
   * Get repository insights
   */
  async getRepositoryInsights(owner: string, repo: string) {
    try {
      const repository = await githubClient.getRepository(owner, repo);
      
      // Perform analysis
      const analysisRequest: AIAnalysisRequest = {
        type: 'performance_analysis',
        content: JSON.stringify(repository),
      };

      const analysis = await aiAnalyzer.analyze(analysisRequest);

      return createResponse(true, {
        repository,
        analysis,
      });
    } catch (error) {
      console.error('Error getting repository insights:', error);
      return createResponse(false, undefined, (error as Error).message);
    }
  }

  /**
   * Health check for all services
   */
  async healthCheck() {
    const checks = {
      database: await databaseClient.healthCheck(),
      github: !!githubClient,
      ai: !!aiAnalyzer,
      webhooks: !!webhookHandler,
    };

    const allHealthy = Object.values(checks).every((check) => check);

    return createResponse(allHealthy, checks);
  }
}

export const serviceOrchestrator = new ServiceOrchestrator();

// Made with Bob
