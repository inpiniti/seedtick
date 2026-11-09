// src/types/feedback.ts - Feedback & Issue Tracker Types
export type FeedbackCategory = 'bug' | 'feature' | 'improvement' | 'other';
export type FeedbackStatus = 'open' | 'in_progress' | 'completed' | 'closed';

export interface FeedbackItem {
  id: string;
  category: FeedbackCategory;
  status: FeedbackStatus;
  title: string;
  content: string;
  authorName: string;
  imageUrls: string[];
  deviceInfo?: string;
  likeCount: number;
  adminResponse?: string | null;
  adminRespondedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewFeedbackInput {
  category: FeedbackCategory;
  title: string;
  content: string;
  authorName: string;
  imageUrls: string[];
  deviceInfo?: string;
}

export type FeedbackStatusFilter = 'all' | 'completed' | 'in_progress' | 'open';
export type FeedbackCategoryFilter = 'all' | FeedbackCategory;
