export type FeedbackCategory = "feature" | "bug" | "general";

export type FeedbackStatus =
  | "received"
  | "reviewing"
  | "in_progress"
  | "completed"
  | "resolved";

export interface FeedbackItem {
  id: string;
  userId: string | null;
  authorName: string;
  authorEmail?: string | null;
  category: FeedbackCategory;
  title: string;
  content: string;
  status: FeedbackStatus;
  adminReply?: string | null;
  repliedAt?: string | null;
  likeCount: number;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  hasLiked?: boolean;
}

export interface FeedbackCreateInput {
  category: FeedbackCategory;
  title: string;
  content: string;
  authorName?: string;
  authorEmail?: string;
  isPrivate?: boolean;
  clientId?: string;
}

export interface FeedbackAdminUpdateInput {
  status: FeedbackStatus;
  adminReply?: string;
}

export interface FeedbackListResponse {
  success: boolean;
  feedbacks: FeedbackItem[];
  total: number;
  counts: {
    total: number;
    received: number;
    reviewing: number;
    inProgress: number;
    completed: number;
    feature: number;
    bug: number;
    general: number;
  };
  message?: string;
}
