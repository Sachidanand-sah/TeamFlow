import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  ClientToServerEvents,
  JoinBoardResult,
  REALTIME_NAMESPACE,
  ServerToClientEvents,
} from '@teamflow/shared';
import { isUUID } from 'class-validator';
import { Subscription } from 'rxjs';
import type { Namespace, Socket } from 'socket.io';
import { DomainEvents } from '../../events/domain-events';
import { AccessTokenPayload } from '../auth/auth.types';
import { ProjectsService } from '../projects/projects.service';
import { MembershipsRepository } from '../workspaces/memberships.repository';

interface SocketData {
  userId: string;
  board?: { workspaceId: string; projectId: string };
  expiryTimer?: ReturnType<typeof setTimeout>;
}

type RealtimeSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
type RealtimeNamespace = Namespace<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

/** Room per board. Includes the workspace so ids can never collide across tenants. */
export function boardRoom(workspaceId: string, projectId: string): string {
  return `ws:${workspaceId}:project:${projectId}`;
}

/**
 * Pushes board events to everyone looking at that board.
 *
 * Security model (see ADR 0004):
 * - Connect: the client sends its ACCESS token (not the refresh cookie). It is
 *   verified exactly like the HTTP guard does (HS256 pinned). Invalid -> disconnect.
 * - The socket is disconnected when the token expires, so a socket cannot outlive
 *   the session. The client refreshes and reconnects.
 * - Join: re-checks workspace membership and that the project belongs to it.
 * - Clients only listen; all changes still go through the HTTP API.
 */
@WebSocketGateway({ namespace: REALTIME_NAMESPACE })
export class RealtimeGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer()
  server!: RealtimeNamespace;

  private subscription?: Subscription;

  constructor(
    private readonly jwt: JwtService,
    private readonly memberships: MembershipsRepository,
    private readonly projects: ProjectsService,
    private readonly events: DomainEvents,
  ) {}

  onModuleInit(): void {
    // Forward every published board event to that board's room.
    this.subscription = this.events.events$.subscribe(
      ({ workspaceId, event }) => {
        this.server
          ?.to(boardRoom(workspaceId, event.projectId))
          .emit('board:event', event);
      },
    );
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  async handleConnection(socket: RealtimeSocket): Promise<void> {
    const token: unknown = socket.handshake.auth?.['token'];
    if (typeof token !== 'string' || token.length === 0) {
      socket.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwt.verifyAsync<
        AccessTokenPayload & { exp: number }
      >(token, { algorithms: ['HS256'] });
      socket.data.userId = payload.sub;
      const msLeft = payload.exp * 1000 - Date.now();
      socket.data.expiryTimer = setTimeout(
        () => socket.disconnect(true),
        msLeft,
      );
    } catch {
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: RealtimeSocket): void {
    clearTimeout(socket.data.expiryTimer);
  }

  /** Returning a value answers the client's acknowledgement callback. */
  @SubscribeMessage('board:join')
  async join(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() body: unknown,
  ): Promise<JoinBoardResult> {
    const userId = socket.data.userId;
    const request = body as {
      workspaceId?: unknown;
      projectId?: unknown;
    } | null;
    const workspaceId = request?.workspaceId;
    const projectId = request?.projectId;
    if (
      !userId ||
      typeof workspaceId !== 'string' ||
      typeof projectId !== 'string' ||
      !isUUID(workspaceId) ||
      !isUUID(projectId)
    ) {
      return { ok: false };
    }

    const membership = await this.memberships.find(workspaceId, userId);
    if (!membership) {
      return { ok: false };
    }
    try {
      // 404s unless the project belongs to this workspace.
      await this.projects.get(
        { workspaceId, userId, role: membership.role },
        projectId,
      );
    } catch {
      return { ok: false };
    }

    this.leaveBoard(socket); // one board per connection
    await socket.join(boardRoom(workspaceId, projectId));
    socket.data.board = { workspaceId, projectId };
    return { ok: true };
  }

  @SubscribeMessage('board:leave')
  leave(@ConnectedSocket() socket: RealtimeSocket): void {
    this.leaveBoard(socket);
  }

  private leaveBoard(socket: RealtimeSocket): void {
    const board = socket.data.board;
    if (board) {
      void socket.leave(boardRoom(board.workspaceId, board.projectId));
      socket.data.board = undefined;
    }
  }
}
