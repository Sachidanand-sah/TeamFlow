/**
 * Socket.IO contracts. Typing both directions means a typo in an event name or a
 * wrong payload shape is a compile error on server and client alike.
 */
import { BoardEvent } from './board-events';

export const REALTIME_NAMESPACE = '/realtime';

export interface JoinBoardRequest {
  workspaceId: string;
  projectId: string;
}

export interface JoinBoardResult {
  ok: boolean;
}

export interface ServerToClientEvents {
  'board:event': (event: BoardEvent) => void;
}

export interface ClientToServerEvents {
  'board:join': (
    request: JoinBoardRequest,
    ack: (result: JoinBoardResult) => void,
  ) => void;
  'board:leave': () => void;
}
