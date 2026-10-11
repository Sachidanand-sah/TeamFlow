import { ActivityDto, describeActivity } from './activity';

const base = {
  id: 'a-1',
  projectId: 'p-1',
  taskId: 't-1',
  taskKey: 'WEB-3',
  actor: { userId: 'u-1', name: 'Ann' },
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('describeActivity', () => {
  it.each<[ActivityDto, string]>([
    [
      { ...base, type: 'TASK_CREATED', data: { title: 'Fix login' } },
      'created WEB-3 "Fix login"',
    ],
    [
      { ...base, type: 'TASK_DELETED', data: { title: 'Fix login' } },
      'deleted WEB-3 "Fix login"',
    ],
    [
      { ...base, type: 'TASK_MOVED', data: { from: 'TODO', to: 'DONE' } },
      'moved WEB-3 from To do to Done',
    ],
    [
      {
        ...base,
        type: 'COMMENT_ADDED',
        data: { commentId: 'c-1', excerpt: 'Looks good' },
      },
      'commented on WEB-3',
    ],
    [
      {
        ...base,
        type: 'TASK_UPDATED',
        data: {
          fields: ['assignee'],
          assignee: { userId: 'u-2', name: 'Bob' },
        },
      },
      'assigned WEB-3 to Bob',
    ],
    [
      {
        ...base,
        type: 'TASK_UPDATED',
        data: { fields: ['assignee'], assignee: null },
      },
      'unassigned WEB-3',
    ],
    [
      { ...base, type: 'TASK_UPDATED', data: { fields: ['priority'] } },
      'changed the priority of WEB-3',
    ],
    [
      {
        ...base,
        type: 'TASK_UPDATED',
        data: { fields: ['title', 'description', 'assignee'], assignee: null },
      },
      'changed the title, description and assignee of WEB-3',
    ],
  ])('%#: %p', (activity, expected) => {
    expect(describeActivity(activity)).toBe(expected);
  });
});
