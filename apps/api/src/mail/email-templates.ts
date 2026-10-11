import { EmailMessage } from './mailer.service';

/**
 * Escapes text for safe insertion into HTML.
 * WHY: task titles, names and comments are user input. Without escaping, a task
 * titled `<img src=x onerror=...>` would inject markup into everyone's inbox.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Subjects are headers: no line breaks (header injection), bounded length. */
function subjectLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').slice(0, 200);
}

function layout(
  paragraphs: string[],
  link: { href: string; label: string },
): string {
  const body = paragraphs.map((p) => `<p>${p}</p>`).join('\n');
  return `<!doctype html>
<html><body style="font-family: system-ui, sans-serif; color: #1d2433; line-height: 1.5;">
${body}
<p><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></p>
<p style="color:#5b6475;font-size:12px;">You receive this because you are a member of this TeamFlow workspace.</p>
</body></html>`;
}

export interface TaskEmailContext {
  recipientEmail: string;
  recipientName: string;
  actorName: string;
  taskKey: string;
  taskTitle: string;
  /** Absolute link to the project board. */
  boardUrl: string;
}

export function taskAssignedEmail(ctx: TaskEmailContext): EmailMessage {
  const subject = subjectLine(
    `[${ctx.taskKey}] ${ctx.taskTitle} was assigned to you`,
  );
  return {
    to: ctx.recipientEmail,
    subject,
    text: [
      `Hi ${ctx.recipientName},`,
      '',
      `${ctx.actorName} assigned ${ctx.taskKey} "${ctx.taskTitle}" to you.`,
      '',
      `Open the board: ${ctx.boardUrl}`,
    ].join('\n'),
    html: layout(
      [
        `Hi ${escapeHtml(ctx.recipientName)},`,
        `${escapeHtml(ctx.actorName)} assigned <strong>${escapeHtml(ctx.taskKey)} ${escapeHtml(ctx.taskTitle)}</strong> to you.`,
      ],
      { href: ctx.boardUrl, label: 'Open the board' },
    ),
  };
}

export interface CommentEmailContext extends TaskEmailContext {
  commentExcerpt: string;
}

export function commentAddedEmail(ctx: CommentEmailContext): EmailMessage {
  const subject = subjectLine(
    `[${ctx.taskKey}] New comment from ${ctx.actorName}`,
  );
  return {
    to: ctx.recipientEmail,
    subject,
    text: [
      `Hi ${ctx.recipientName},`,
      '',
      `${ctx.actorName} commented on ${ctx.taskKey} "${ctx.taskTitle}":`,
      '',
      ctx.commentExcerpt,
      '',
      `Open the board: ${ctx.boardUrl}`,
    ].join('\n'),
    html: layout(
      [
        `Hi ${escapeHtml(ctx.recipientName)},`,
        `${escapeHtml(ctx.actorName)} commented on <strong>${escapeHtml(ctx.taskKey)} ${escapeHtml(ctx.taskTitle)}</strong>:`,
        `<blockquote style="margin:0;padding-left:12px;border-left:3px solid #d0d5dd;">${escapeHtml(ctx.commentExcerpt)}</blockquote>`,
      ],
      { href: ctx.boardUrl, label: 'Open the board' },
    ),
  };
}
