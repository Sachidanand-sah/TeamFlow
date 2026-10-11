import {
  canDeleteTask,
  canEditTasks,
  formatTaskKey,
  moveTask,
  Positioned,
  TaskStatus,
} from './tasks';

const t = (id: string, status: TaskStatus, position: number): Positioned => ({
  id,
  status,
  position,
});

/** Column contents, top to bottom, for readable assertions. */
function column(tasks: Positioned[], status: TaskStatus): string[] {
  return tasks
    .filter((x) => x.status === status)
    .sort((a, b) => a.position - b.position)
    .map((x) => x.id);
}

describe('moveTask', () => {
  const board = [
    t('a', 'TODO', 0),
    t('b', 'TODO', 1),
    t('c', 'TODO', 2),
    t('x', 'DONE', 0),
    t('y', 'DONE', 1),
  ];

  it('reorders within a column', () => {
    const result = moveTask(board, 'a', 'TODO', 2);

    expect(column(result, 'TODO')).toEqual(['b', 'c', 'a']);
    expect(result.find((x) => x.id === 'a')?.position).toBe(2);
  });

  it('moves to another column and closes the gap behind it', () => {
    const result = moveTask(board, 'b', 'DONE', 1);

    expect(column(result, 'TODO')).toEqual(['a', 'c']);
    expect(column(result, 'DONE')).toEqual(['x', 'b', 'y']);
    expect(
      result
        .filter((x) => x.status === 'TODO')
        .map((x) => x.position)
        .sort(),
    ).toEqual([0, 1]);
  });

  it('moves into an empty column', () => {
    const result = moveTask(board, 'c', 'IN_REVIEW', 0);

    expect(column(result, 'IN_REVIEW')).toEqual(['c']);
    expect(result.find((x) => x.id === 'c')).toEqual(t('c', 'IN_REVIEW', 0));
  });

  it('clamps an index past the end of the column', () => {
    const result = moveTask(board, 'a', 'DONE', 99);

    expect(column(result, 'DONE')).toEqual(['x', 'y', 'a']);
  });

  it('clamps a negative index to the top', () => {
    const result = moveTask(board, 'y', 'DONE', -5);

    expect(column(result, 'DONE')).toEqual(['y', 'x']);
  });

  it('does not mutate the input', () => {
    const copy = JSON.parse(JSON.stringify(board));
    moveTask(board, 'a', 'DONE', 0);

    expect(board).toEqual(copy);
  });

  it('returns the tasks unchanged for an unknown id', () => {
    expect(moveTask(board, 'nope', 'DONE', 0)).toEqual(board);
  });

  it('repairs gaps in positions while moving', () => {
    const gappy = [t('a', 'TODO', 3), t('b', 'TODO', 10)];

    const result = moveTask(gappy, 'b', 'TODO', 0);

    expect(result).toEqual([t('a', 'TODO', 1), t('b', 'TODO', 0)]);
  });
});

describe('task permissions', () => {
  it('lets MEMBER and above edit tasks, not VIEWER', () => {
    expect(canEditTasks('VIEWER')).toBe(false);
    expect(canEditTasks('MEMBER')).toBe(true);
    expect(canEditTasks('OWNER')).toBe(true);
  });

  it.each([
    ['VIEWER', true, false],
    ['MEMBER', false, false],
    ['MEMBER', true, true],
    ['ADMIN', false, true],
    ['OWNER', false, true],
  ] as const)(
    '%s (reporter: %s) can delete: %s',
    (role, isReporter, expected) => {
      expect(canDeleteTask(role, isReporter)).toBe(expected);
    },
  );
});

describe('formatTaskKey', () => {
  it('joins project key and number', () => {
    expect(formatTaskKey('WEB', 12)).toBe('WEB-12');
  });
});
