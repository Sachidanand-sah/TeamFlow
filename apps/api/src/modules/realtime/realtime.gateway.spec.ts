import { NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { BoardEvent } from '@teamflow/shared';
import { DomainEvents } from '../../events/domain-events';
import { Membership } from '../../generated/prisma/client';
import { ProjectsService } from '../projects/projects.service';
import { MembershipsRepository } from '../workspaces/memberships.repository';
import { boardRoom, RealtimeGateway } from './realtime.gateway';

const SECRET = 'test-secret-that-is-at-least-32-chars';
const WS = '0b5f8c1e-3a8e-4c0e-9f7a-1d2b3c4d5e6f';
const PROJECT = '1c6f9d2f-4b9f-4d1f-8a8b-2e3c4d5e6f70';

interface FakeSocket {
  handshake: { auth: Record<string, unknown> };
  data: Record<string, unknown>;
  disconnect: jest.Mock;
  join: jest.Mock;
  leave: jest.Mock;
}

function fakeSocket(token?: unknown): FakeSocket {
  return {
    handshake: { auth: token === undefined ? {} : { token } },
    data: {},
    disconnect: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
  };
}

const membership: Membership = {
  id: 'm-1',
  workspaceId: WS,
  userId: 'user-1',
  role: 'VIEWER',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('RealtimeGateway', () => {
  const jwt = new JwtService({
    secret: SECRET,
    signOptions: { expiresIn: 900 },
  });
  let memberships: jest.Mocked<Pick<MembershipsRepository, 'find'>>;
  let projects: jest.Mocked<Pick<ProjectsService, 'get'>>;
  let events: DomainEvents;
  let gateway: RealtimeGateway;

  beforeEach(() => {
    // Fake setTimeout (token expiry) but not setImmediate/nextTick, which the JWT
    // library uses internally while signing and verifying.
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
    memberships = { find: jest.fn().mockResolvedValue(membership) };
    projects = { get: jest.fn() };
    events = new DomainEvents();
    gateway = new RealtimeGateway(
      jwt,
      memberships as unknown as MembershipsRepository,
      projects as unknown as ProjectsService,
      events,
    );
  });

  afterEach(() => {
    gateway.onModuleDestroy();
    jest.useRealTimers();
  });

  // The gateway's methods are typed for real sockets; the fake has what they use.
  const asSocket = (s: FakeSocket) =>
    s as unknown as Parameters<RealtimeGateway['join']>[0];

  async function connected(): Promise<FakeSocket> {
    const token = await jwt.signAsync({ sub: 'user-1', email: 'a@b.co' });
    const socket = fakeSocket(token);
    await gateway.handleConnection(asSocket(socket));
    return socket;
  }

  describe('handleConnection', () => {
    it('accepts a valid access token and remembers the user', async () => {
      const socket = await connected();

      expect(socket.disconnect).not.toHaveBeenCalled();
      expect(socket.data['userId']).toBe('user-1');
    });

    it('disconnects when the token expires', async () => {
      const socket = await connected();

      jest.advanceTimersByTime(901_000);

      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it.each([undefined, '', 42, 'not-a-jwt'])(
      'rejects token %p',
      async (token) => {
        const socket = fakeSocket(token);

        await gateway.handleConnection(asSocket(socket));

        expect(socket.disconnect).toHaveBeenCalledWith(true);
      },
    );

    it('rejects a token signed with another secret', async () => {
      const forged = await new JwtService({
        secret: 'another-secret-another-secret-123',
      }).signAsync({ sub: 'user-1', email: 'a@b.co' });
      const socket = fakeSocket(forged);

      await gateway.handleConnection(asSocket(socket));

      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('join', () => {
    it('joins the board room after checking membership and project', async () => {
      const socket = await connected();

      const result = await gateway.join(asSocket(socket), {
        workspaceId: WS,
        projectId: PROJECT,
      });

      expect(result).toEqual({ ok: true });
      expect(memberships.find).toHaveBeenCalledWith(WS, 'user-1');
      expect(projects.get).toHaveBeenCalledWith(
        { workspaceId: WS, userId: 'user-1', role: 'VIEWER' },
        PROJECT,
      );
      expect(socket.join).toHaveBeenCalledWith(boardRoom(WS, PROJECT));
    });

    it('refuses non-members', async () => {
      memberships.find.mockResolvedValue(null);
      const socket = await connected();

      const result = await gateway.join(asSocket(socket), {
        workspaceId: WS,
        projectId: PROJECT,
      });

      expect(result).toEqual({ ok: false });
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('refuses a project from another workspace', async () => {
      projects.get.mockRejectedValue(new NotFoundException());
      const socket = await connected();

      const result = await gateway.join(asSocket(socket), {
        workspaceId: WS,
        projectId: PROJECT,
      });

      expect(result).toEqual({ ok: false });
    });

    it.each([null, {}, { workspaceId: 'x', projectId: PROJECT }, 'junk'])(
      'refuses malformed request %p',
      async (body) => {
        const socket = await connected();

        expect(await gateway.join(asSocket(socket), body)).toEqual({
          ok: false,
        });
        expect(memberships.find).not.toHaveBeenCalled();
      },
    );

    it('leaves the previous board when joining another', async () => {
      const socket = await connected();
      const other = '2d7fae30-5caf-4e2f-9b9c-3f4d5e6f7081';
      await gateway.join(asSocket(socket), {
        workspaceId: WS,
        projectId: PROJECT,
      });

      await gateway.join(asSocket(socket), {
        workspaceId: WS,
        projectId: other,
      });

      expect(socket.leave).toHaveBeenCalledWith(boardRoom(WS, PROJECT));
      expect(socket.join).toHaveBeenLastCalledWith(boardRoom(WS, other));
    });
  });

  describe('event forwarding', () => {
    it("emits published events to that board's room only", () => {
      const emit = jest.fn();
      const to = jest.fn().mockReturnValue({ emit });
      gateway.server = { to } as unknown as RealtimeGateway['server'];
      gateway.onModuleInit();
      const event: BoardEvent = {
        type: 'task.deleted',
        taskId: 't-1',
        projectId: PROJECT,
        actorId: 'user-1',
      };

      events.publish({ workspaceId: WS, event });

      expect(to).toHaveBeenCalledWith(boardRoom(WS, PROJECT));
      expect(emit).toHaveBeenCalledWith('board:event', event);
    });
  });
});
