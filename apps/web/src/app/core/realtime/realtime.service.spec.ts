import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BoardEvent } from '@teamflow/shared';
import { of, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import {
  BoardStreamEvent,
  RealtimeService,
  SOCKET_FACTORY,
} from './realtime.service';

type Handler = (...args: unknown[]) => void;

/** Minimal stand-in for a Socket.IO client socket. */
class FakeSocket {
  connected = false;
  handlers = new Map<string, Handler[]>();
  emitted: { event: string; args: unknown[] }[] = [];
  joinResult = { ok: true };

  on(event: string, handler: Handler) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
    return this;
  }
  off(event: string, handler: Handler) {
    this.handlers.set(
      event,
      (this.handlers.get(event) ?? []).filter((h) => h !== handler),
    );
    return this;
  }
  emit(event: string, ...args: unknown[]) {
    this.emitted.push({ event, args });
    const ack = args[1];
    if (event === 'board:join' && typeof ack === 'function')
      ack(this.joinResult);
    return this;
  }
  connect = jest.fn(() => {
    this.connected = true;
    this.fire('connect');
  });
  disconnect = jest.fn(() => {
    this.connected = false;
  });
  /** Simulate the server sending us something. */
  fire(event: string, ...args: unknown[]) {
    for (const h of this.handlers.get(event) ?? []) h(...args);
  }
  joins() {
    return this.emitted.filter((e) => e.event === 'board:join').length;
  }
}

const event = (projectId: string): BoardEvent => ({
  type: 'task.deleted',
  taskId: 't-1',
  projectId,
  actorId: 'u-2',
});

describe('RealtimeService', () => {
  let socket: FakeSocket;
  let auth: {
    getAccessToken: jest.Mock;
    refresh: jest.Mock;
    isAuthenticated: ReturnType<typeof signal<boolean>>;
  };
  let service: RealtimeService;
  let tokenGetter: () => string | null;

  beforeEach(() => {
    socket = new FakeSocket();
    auth = {
      getAccessToken: jest.fn().mockReturnValue('access-1'),
      refresh: jest.fn().mockReturnValue(of({})),
      isAuthenticated: signal(true),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        {
          provide: SOCKET_FACTORY,
          useValue: (getToken: () => string | null) => {
            tokenGetter = getToken;
            return socket;
          },
        },
      ],
    });
    service = TestBed.inject(RealtimeService);
  });

  it('connects lazily, joins the board and passes its events through', () => {
    const received: BoardStreamEvent[] = [];
    service.boardEvents('ws-1', 'p-1').subscribe((e) => received.push(e));

    expect(socket.connect).toHaveBeenCalled();
    expect(socket.emitted[0].event).toBe('board:join');
    expect(socket.emitted[0].args[0]).toEqual({
      workspaceId: 'ws-1',
      projectId: 'p-1',
    });
    expect(tokenGetter()).toBe('access-1');

    socket.fire('board:event', event('p-1'));
    socket.fire('board:event', event('p-other'));
    expect(received).toEqual([event('p-1')]);
  });

  it('shares one join between listeners and leaves only after the last one', () => {
    const a = service.boardEvents('ws-1', 'p-1').subscribe();
    const b = service.boardEvents('ws-1', 'p-1').subscribe();
    expect(socket.joins()).toBe(1);

    a.unsubscribe();
    expect(socket.emitted.some((e) => e.event === 'board:leave')).toBe(false);

    b.unsubscribe();
    expect(socket.emitted.some((e) => e.event === 'board:leave')).toBe(true);
  });

  it('rejoins after a reconnect and asks the board to resync', () => {
    const received: BoardStreamEvent[] = [];
    service.boardEvents('ws-1', 'p-1').subscribe((e) => received.push(e));

    socket.fire('connect'); // reconnected

    expect(socket.joins()).toBe(2);
    expect(received).toEqual([{ type: 'resync' }]);
  });

  it('refreshes the session and reconnects after a server-side disconnect', () => {
    service.boardEvents('ws-1', 'p-1').subscribe();
    socket.connect.mockClear();

    socket.fire('disconnect', 'io server disconnect');

    expect(auth.refresh).toHaveBeenCalled();
    expect(socket.connect).toHaveBeenCalled();
  });

  it('does not loop when refresh fails or disconnects repeat quickly', () => {
    auth.refresh.mockReturnValue(throwError(() => new Error('expired')));
    service.boardEvents('ws-1', 'p-1').subscribe();
    socket.connect.mockClear();

    socket.fire('disconnect', 'io server disconnect');
    socket.fire('disconnect', 'io server disconnect');

    expect(auth.refresh).toHaveBeenCalledTimes(1);
    expect(socket.connect).not.toHaveBeenCalled();
  });

  it('disconnects when the user signs out', () => {
    service.boardEvents('ws-1', 'p-1').subscribe();

    auth.isAuthenticated.set(false);
    TestBed.tick();

    expect(socket.disconnect).toHaveBeenCalled();
  });
});
