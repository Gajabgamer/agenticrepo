// GitHub Types
export interface GitHubWebhookPayload {
  action?: string;
  repository: {
    id: number;
    name: string;
    full_name: string;
    default_branch?: string;
    clone_url?: string;
    owner: {
      login: string;
      id: number;
    };
  };
  sender: {
    login: string;
    id: number;
  };
  installation?: {
    id?: number;
  };
  ref?: string;
  pusher?: {
    name?: string;
  };
  pull_request?: {
    number?: number;
    title?: string;
    changed_files?: number;
    files?: Array<{ filename?: string }>;
    head?: {
      ref?: string;
    };
  };
  workflow_run?: {
    id?: number;
    name?: string;
    head_branch?: string;
    head_sha?: string;
    status?: string;
    conclusion?: string;
  };
  issue?: {
    number?: number;
    pull_request?: unknown;
  };
  comment?: {
    id?: number;
  };
  [key: string]: unknown;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  owner: {
    login: string;
    id: number;
  };
}

// AI Analysis Types
export interface AIAnalysisRequest {
  type: 'code_review' | 'security_scan' | 'performance_analysis';
  content: string;
  context?: Record<string, unknown>;
}

export interface AIAnalysisResponse {
  analysis: string;
  suggestions: string[];
  severity?: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, unknown>;
}

// Database Types
export interface DatabaseRecord {
  id: string;
  created_at: Date;
  updated_at: Date;
}

export interface WebhookEvent extends DatabaseRecord {
  event_type: string;
  payload: GitHubWebhookPayload;
  processed: boolean;
  error?: string;
}

// Service Response Types
export interface ServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// Made with Bob
