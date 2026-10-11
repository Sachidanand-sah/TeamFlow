import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TaskDto, WorkspaceRole } from '@teamflow/shared';
import { DomainEvents } from '../../events/domain-events';
import { StorageService } from '../../storage/storage.service';
import { TasksService } from '../tasks/tasks.service';
import { WorkspaceMember } from '../workspaces/workspace-member';
import {
  AttachmentsRepository,
  AttachmentWithUploader,
} from './attachments.repository';
import { AttachmentsService, taskPrefix } from './attachments.service';

const WS = 'ws-1';
const P = 'p-1';
const T = 't-1';
const KEY = `workspaces/${WS}/tasks/${T}/abc`;

const member = (role: WorkspaceRole, userId = 'me'): WorkspaceMember => ({
  workspaceId: WS,
  userId,
  role,
});

function row(
  overrides: Partial<AttachmentWithUploader> = {},
): AttachmentWithUploader {
  return {
    id: 'a-1',
    workspaceId: WS,
    taskId: T,
    uploaderId: 'me',
    fileName: 'report.pdf',
    contentType: 'application/pdf',
    size: 1234,
    storageKey: KEY,
    status: 'PENDING',
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    uploader: { id: 'me', name: 'Me' },
    ...overrides,
  };
}

describe('AttachmentsService', () => {
  let repo: jest.Mocked<
    Pick<
      AttachmentsRepository,
      'listReady' | 'find' | 'create' | 'markReady' | 'delete'
    >
  >;
  let tasks: jest.Mocked<Pick<TasksService, 'get'>>;
  let storage: jest.Mocked<
    Pick<
      StorageService,
      'createUpload' | 'head' | 'downloadUrl' | 'delete' | 'deletePrefix'
    >
  >;
  let events: DomainEvents;
  let service: AttachmentsService;

  beforeEach(() => {
    repo = {
      listReady: jest.fn(),
      find: jest.fn().mockResolvedValue(row()),
      create: jest.fn().mockResolvedValue(row()),
      markReady: jest.fn().mockResolvedValue(row({ status: 'READY' })),
      delete: jest.fn(),
    };
    tasks = { get: jest.fn().mockResolvedValue({ id: T } as TaskDto) };
    storage = {
      createUpload: jest
        .fn()
        .mockResolvedValue({
          url: 'http://s3/bucket/k',
          method: 'PUT',
          headers: {},
        }),
      head: jest.fn(),
      downloadUrl: jest.fn().mockResolvedValue('http://s3/signed'),
      delete: jest.fn().mockResolvedValue(undefined),
      deletePrefix: jest.fn().mockResolvedValue(undefined),
    };
    events = new DomainEvents();
    service = new AttachmentsService(
      repo as unknown as AttachmentsRepository,
      tasks as unknown as TasksService,
      storage as unknown as StorageService,
      events,
    );
  });

  afterEach(() => service.onModuleDestroy());

  describe('list', () => {
    it('checks the task, then lists READY files only', async () => {
      repo.listReady.mockResolvedValue([row({ status: 'READY' })]);

      const result = await service.list(member('VIEWER'), P, T);

      expect(tasks.get).toHaveBeenCalledWith(member('VIEWER'), P, T);
      expect(repo.listReady).toHaveBeenCalledWith(WS, T);
      expect(result[0]).toEqual({
        id: 'a-1',
        taskId: T,
        fileName: 'report.pdf',
        contentType: 'application/pdf',
        size: 1234,
        uploader: { userId: 'me', name: 'Me' },
        createdAt: '2026-07-01T00:00:00.000Z',
      });
      expect(result[0]).not.toHaveProperty('storageKey');
    });
  });

  describe('create', () => {
    it('stores a PENDING row under a server-made key and returns a signed upload', async () => {
      const result = await service.create(member('MEMBER'), P, T, {
        fileName: '../../secret/report.pdf',
        contentType: 'application/pdf',
        size: 1234,
      });

      const data = repo.create.mock.calls[0][2];
      expect(data.fileName).toBe('report.pdf');
      expect(data.uploaderId).toBe('me');
      expect(data.storageKey.startsWith(taskPrefix(WS, T))).toBe(true);
      expect(data.storageKey).not.toContain('report');
      expect(storage.createUpload).toHaveBeenCalledWith(
        data.storageKey,
        'application/pdf',
        1234,
        'report.pdf',
      );
      expect(result.upload).toEqual({
        url: 'http://s3/bucket/k',
        method: 'PUT',
        headers: {},
      });
    });

    it('404s for a task elsewhere, before touching storage', async () => {
      tasks.get.mockRejectedValue(new NotFoundException());

      await expect(
        service.create(member('MEMBER'), P, 'x', {
          fileName: 'a.pdf',
          contentType: 'application/pdf',
          size: 1,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.create).not.toHaveBeenCalled();
      expect(storage.createUpload).not.toHaveBeenCalled();
    });
  });

  describe('complete', () => {
    it('marks READY when the stored object matches', async () => {
      storage.head.mockResolvedValue({
        size: 1234,
        contentType: 'application/pdf',
      });

      const result = await service.complete(member('MEMBER'), P, T, 'a-1');

      expect(storage.head).toHaveBeenCalledWith(KEY);
      expect(repo.markReady).toHaveBeenCalledWith('a-1');
      expect(result.id).toBe('a-1');
    });

    it.each([
      ['missing', null],
      ['wrong size', { size: 999_999, contentType: 'application/pdf' }],
      ['wrong type', { size: 1234, contentType: 'text/html' }],
    ])(
      'rejects and cleans up when the object is %s',
      async (_label, stored) => {
        storage.head.mockResolvedValue(stored);

        await expect(
          service.complete(member('MEMBER'), P, T, 'a-1'),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(repo.markReady).not.toHaveBeenCalled();
        expect(repo.delete).toHaveBeenCalledWith(WS, T, 'a-1');
        if (stored) expect(storage.delete).toHaveBeenCalledWith(KEY);
      },
    );

    it('only lets the uploader complete', async () => {
      repo.find.mockResolvedValue(row({ uploaderId: 'bob' }));

      await expect(
        service.complete(member('ADMIN'), P, T, 'a-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('is idempotent for an already READY file', async () => {
      repo.find.mockResolvedValue(row({ status: 'READY' }));

      await service.complete(member('MEMBER'), P, T, 'a-1');

      expect(storage.head).not.toHaveBeenCalled();
    });
  });

  describe('download', () => {
    it('returns a signed URL for a READY file', async () => {
      repo.find.mockResolvedValue(row({ status: 'READY' }));

      await expect(
        service.download(member('VIEWER'), P, T, 'a-1'),
      ).resolves.toEqual({
        url: 'http://s3/signed',
      });
      expect(storage.downloadUrl).toHaveBeenCalledWith(KEY);
    });

    it('hides PENDING files', async () => {
      await expect(
        service.download(member('VIEWER'), P, T, 'a-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404s for an attachment on another task', async () => {
      repo.find.mockResolvedValue(null);

      await expect(
        service.download(member('VIEWER'), P, T, 'a-x'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('delete', () => {
    it('removes row then object for the uploader', async () => {
      await service.delete(member('MEMBER'), P, T, 'a-1');

      expect(repo.delete).toHaveBeenCalledWith(WS, T, 'a-1');
      expect(storage.delete).toHaveBeenCalledWith(KEY);
    });

    it("forbids a MEMBER from deleting someone else's file", async () => {
      repo.find.mockResolvedValue(row({ uploaderId: 'bob' }));

      await expect(
        service.delete(member('MEMBER'), P, T, 'a-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('still succeeds if storage deletion fails (object is orphaned, not listed)', async () => {
      storage.delete.mockRejectedValue(new Error('minio down'));
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      await expect(
        service.delete(member('ADMIN'), P, T, 'a-1'),
      ).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe('task deletion', () => {
    it("deletes the task's files from storage", () => {
      service.onModuleInit();

      events.publish({
        workspaceId: WS,
        event: { type: 'task.deleted', taskId: T, projectId: P, actorId: 'me' },
      });

      expect(storage.deletePrefix).toHaveBeenCalledWith(taskPrefix(WS, T));
    });

    it('ignores other events', () => {
      service.onModuleInit();

      events.publish({
        workspaceId: WS,
        event: {
          type: 'task.moved',
          taskId: T,
          status: 'DONE',
          index: 0,
          projectId: P,
          actorId: 'me',
        },
      });

      expect(storage.deletePrefix).not.toHaveBeenCalled();
    });
  });
});
