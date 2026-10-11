import {
  commentAddedEmail,
  escapeHtml,
  taskAssignedEmail,
  TaskEmailContext,
} from './email-templates';

const ctx: TaskEmailContext = {
  recipientEmail: 'bob@example.com',
  recipientName: 'Bob',
  actorName: 'Ann',
  taskKey: 'WEB-3',
  taskTitle: 'Fix login',
  boardUrl: 'http://localhost:4200/workspaces/w/projects/p',
};

describe('escapeHtml', () => {
  it('escapes every HTML-significant character', () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });
});

describe('taskAssignedEmail', () => {
  it('addresses the assignee with a subject, text and HTML version', () => {
    const email = taskAssignedEmail(ctx);

    expect(email.to).toBe('bob@example.com');
    expect(email.subject).toBe('[WEB-3] Fix login was assigned to you');
    expect(email.text).toContain('Ann assigned WEB-3 "Fix login" to you.');
    expect(email.text).toContain(ctx.boardUrl);
    expect(email.html).toContain(`href="${ctx.boardUrl}"`);
  });

  it('cannot be used to inject HTML through user-controlled fields', () => {
    const email = taskAssignedEmail({
      ...ctx,
      actorName: '<b>Mallory</b>',
      taskTitle: '<img src=x onerror=alert(1)>',
    });

    expect(email.html).not.toContain('<img');
    expect(email.html).not.toContain('<b>Mallory');
    expect(email.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('strips line breaks from the subject (header injection)', () => {
    const email = taskAssignedEmail({
      ...ctx,
      taskTitle: 'x\r\nBcc: all@corp.com',
    });

    expect(email.subject).not.toMatch(/[\r\n]/);
  });
});

describe('commentAddedEmail', () => {
  it('quotes the escaped excerpt', () => {
    const email = commentAddedEmail({ ...ctx, commentExcerpt: 'Looks <good>' });

    expect(email.subject).toBe('[WEB-3] New comment from Ann');
    expect(email.text).toContain('Looks <good>');
    expect(email.html).toContain('Looks &lt;good&gt;');
  });
});
