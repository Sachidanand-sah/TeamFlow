/**
 * Events about one project's board. The API publishes them after each successful
 * change; the real-time gateway forwards them to everyone viewing that board.
 */
import { ActivityDto } from './activity';
import { CommentDto } from './comments';
import { TaskDto, TaskStatus } from './tasks';

export type BoardEventPayload =
  | { type: 'task.upserted'; task: TaskDto }
  /** Positions of other tasks changed too, so clients reload the board. */
  | { type: 'task.moved'; taskId: string; status: TaskStatus; index: number }
  | { type: 'task.deleted'; taskId: string }
  | { type: 'comment.upserted'; comment: CommentDto }
  | { type: 'comment.deleted'; taskId: string; commentId: string }
  | { type: 'activity.recorded'; activity: ActivityDto };

export type BoardEvent = BoardEventPayload & {
  projectId: string;
  /** Who caused it, so a client can skip echoes of its own actions. */
  actorId: string;
};
