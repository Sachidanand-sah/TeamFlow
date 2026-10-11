import {
  effect,
  inject,
  Injectable,
  InjectionToken,
  OnDestroy,
} from '@angular/core';
import {
  BoardEvent,
  ClientToServerEvents,
  REALTIME_NAMESPACE,
  ServerToClientEvents,
} from '@teamflow/shared';
import { Observable, share } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { AuthService } from '../auth/auth.service';

export type RealtimeSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const RETRY_GAP_MS = 10_000;

/** What the board receives: server events, plus a hint to reload after reconnects. */
export type BoardStreamEvent = BoardEvent | { type: 'resync' };

/**
 * Creates the socket. A token so tests can provide a fake instead of a network
 * connection. `auth` is a callback: Socket.IO calls it on EVERY (re)connect, so a
 * reconnect always sends the current access token, never a stale one.
 */
export const SOCKET_FACTORY = new InjectionToken<
  (getToken: () => string | null) => RealtimeSocket
>('SOCKET_FACTORY', {
  providedIn: 'root',
  factory: () => (getToken) =>
    io(REALTIME_NAMESPACE, {
      autoConnect: false,
      transports: ['websocket'],
      auth: (cb) => cb({ token: getToken() }),
    }),
});

/**
 * One shared socket for the app; one shared stream per board.
 *
 * WHY share per board: the board and the activity feed both listen to the same
 * project. Sharing means one `board:join`, and the `board:leave` is only sent when
 * the LAST listener unsubscribes.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly createSocket = inject(SOCKET_FACTORY);
  private socket: RealtimeSocket | null = null;
  private readonly streams = new Map<string, Observable<BoardStreamEvent>>();
  private lastRetry = 0;

  constructor() {
    // Signing out closes the socket: no events for a session that has ended.
    effect(() => {
      if (!this.auth.isAuthenticated()) {
        this.socket?.disconnect();
      }
    });
  }

  boardEvents(
    workspaceId: string,
    projectId: string,
  ): Observable<BoardStreamEvent> {
    const key = `${workspaceId}/${projectId}`;
    let stream = this.streams.get(key);
    if (!stream) {
      stream = this.createBoardStream(workspaceId, projectId).pipe(
        share({ resetOnRefCountZero: true }),
      );
      this.streams.set(key, stream);
    }
    return stream;
  }

  ngOnDestroy(): void {
    this.socket?.disconnect();
  }

  private createBoardStream(
    workspaceId: string,
    projectId: string,
  ): Observable<BoardStreamEvent> {
    return new Observable<BoardStreamEvent>((subscriber) => {
      const socket = this.ensureSocket();
      let joinedBefore = false;

      const join = () => {
        socket.emit('board:join', { workspaceId, projectId }, (result) => {
          // After a reconnect we may have missed events: ask the board to reload.
          if (result.ok && joinedBefore) subscriber.next({ type: 'resync' });
          joinedBefore = joinedBefore || result.ok;
        });
      };
      const onEvent = (event: BoardEvent) => {
        if (event.projectId === projectId) subscriber.next(event);
      };

      socket.on('connect', join);
      socket.on('board:event', onEvent);
      if (socket.connected) {
        join();
      } else {
        socket.connect();
      }

      return () => {
        socket.off('connect', join);
        socket.off('board:event', onEvent);
        socket.emit('board:leave');
        this.streams.delete(`${workspaceId}/${projectId}`);
      };
    });
  }

  private ensureSocket(): RealtimeSocket {
    if (this.socket) return this.socket;

    const socket = this.createSocket(() => this.auth.getAccessToken());
    // The server disconnects us when the access token expires (or is invalid).
    // Socket.IO does not auto-reconnect after a server-side disconnect, so refresh
    // the session and reconnect ourselves; if refresh fails, stay disconnected.
    socket.on('disconnect', (reason) => {
      // Brake: never retry more than once per RETRY_GAP_MS, so a server that keeps
      // rejecting us cannot turn this into a tight refresh/reconnect loop.
      const now = Date.now();
      if (
        reason === 'io server disconnect' &&
        now - this.lastRetry > RETRY_GAP_MS
      ) {
        this.lastRetry = now;
        this.auth.refresh().subscribe({
          next: () => socket.connect(),
          error: () => undefined,
        });
      }
    });
    this.socket = socket;
    return socket;
  }
}
