import {
  canDeleteAttachment,
  canUploadAttachment,
  formatFileSize,
  isAllowedAttachmentType,
  sanitizeFileName,
} from './attachments';

describe('isAllowedAttachmentType', () => {
  it.each(['image/png', 'application/pdf', 'text/csv'])('allows %p', (type) => {
    expect(isAllowedAttachmentType(type)).toBe(true);
  });

  it.each(['text/html', 'image/svg+xml', 'application/javascript', ''])(
    'refuses %p (could execute in a browser, or unknown)',
    (type) => {
      expect(isAllowedAttachmentType(type)).toBe(false);
    },
  );
});

describe('sanitizeFileName', () => {
  it.each([
    ['report.pdf', 'report.pdf'],
    ['../../etc/passwd', 'passwd'],
    ['C:\\Users\\me\\notes.txt', 'notes.txt'],
    ['bad"name<>.png', 'badname.png'],
    ['line\nbreak.txt', 'linebreak.txt'],
    ['.hidden', 'hidden'],
    ['', 'file'],
    ['///', 'file'],
  ])('%p -> %p', (input, expected) => {
    expect(sanitizeFileName(input)).toBe(expected);
  });

  it('keeps the end of very long names (where the extension is)', () => {
    const result = sanitizeFileName(`${'a'.repeat(300)}.pdf`);

    expect(result.length).toBe(200);
    expect(result.endsWith('.pdf')).toBe(true);
  });
});

describe('attachment permissions', () => {
  it('lets MEMBER and above upload', () => {
    expect(canUploadAttachment('VIEWER')).toBe(false);
    expect(canUploadAttachment('MEMBER')).toBe(true);
  });

  it.each([
    ['MEMBER', true, true],
    ['MEMBER', false, false],
    ['ADMIN', false, true],
    ['VIEWER', true, false],
  ] as const)(
    '%s (uploader: %s) can delete: %s',
    (role, isUploader, expected) => {
      expect(canDeleteAttachment(role, isUploader)).toBe(expected);
    },
  );
});

describe('formatFileSize', () => {
  it.each([
    [500, '500 B'],
    [2048, '2.0 KB'],
    [5 * 1024 * 1024, '5.0 MB'],
  ])('%i -> %p', (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });
});
