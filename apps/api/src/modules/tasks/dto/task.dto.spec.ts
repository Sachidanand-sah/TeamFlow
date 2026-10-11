import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateTaskDto, MoveTaskDto, UpdateTaskDto } from './task.dto';

// Mirrors the global ValidationPipe (transform, whitelist, forbid unknown fields).
function errorsFor<T extends object>(cls: new () => T, body: object): string[] {
  const dto = plainToInstance(cls, body);
  return validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).map(
    (e) => e.property,
  );
}

const UUID = '0b5f8c1e-3a8e-4c0e-9f7a-1d2b3c4d5e6f';

describe('CreateTaskDto', () => {
  it('accepts a title only', () => {
    expect(errorsFor(CreateTaskDto, { title: 'Fix login' })).toEqual([]);
  });

  it('accepts all fields', () => {
    expect(
      errorsFor(CreateTaskDto, {
        title: 'Fix login',
        description: 'Steps...',
        status: 'IN_PROGRESS',
        priority: 'URGENT',
        assigneeId: UUID,
      }),
    ).toEqual([]);
  });

  it.each([
    [{ title: '   ' }, 'title'],
    [{ title: 'X', status: 'BLOCKED' }, 'status'],
    [{ title: 'X', priority: 'NOW' }, 'priority'],
    [{ title: 'X', assigneeId: 'bob' }, 'assigneeId'],
    [{ title: 'X', number: 99 }, 'number'],
  ])('rejects %p', (body, property) => {
    expect(errorsFor(CreateTaskDto, body)).toContain(property);
  });
});

describe('UpdateTaskDto', () => {
  it('accepts null to clear description and unassign', () => {
    expect(
      errorsFor(UpdateTaskDto, { description: null, assigneeId: null }),
    ).toEqual([]);
  });

  it.each([
    [{ title: null }, 'title'],
    [{ priority: null }, 'priority'],
    [{ status: 'DONE' }, 'status'],
  ])('rejects %p', (body, property) => {
    expect(errorsFor(UpdateTaskDto, body)).toContain(property);
  });
});

describe('MoveTaskDto', () => {
  it('accepts a status and index', () => {
    expect(errorsFor(MoveTaskDto, { status: 'DONE', index: 0 })).toEqual([]);
  });

  it.each([
    [{ status: 'DONE', index: -1 }, 'index'],
    [{ status: 'DONE', index: 1.5 }, 'index'],
    [{ status: 'NOPE', index: 0 }, 'status'],
  ])('rejects %p', (body, property) => {
    expect(errorsFor(MoveTaskDto, body)).toContain(property);
  });
});
