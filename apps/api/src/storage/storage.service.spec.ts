import { contentDisposition } from './storage.service';

describe('contentDisposition', () => {
  it('forces download with the original name', () => {
    expect(contentDisposition('report.pdf')).toBe(
      `attachment; filename="report.pdf"; filename*=UTF-8''report.pdf`,
    );
  });

  it('keeps non-ASCII names in the UTF-8 parameter', () => {
    expect(contentDisposition('Überblick.pdf')).toBe(
      `attachment; filename="_berblick.pdf"; filename*=UTF-8''%C3%9Cberblick.pdf`,
    );
  });

  it('cannot be broken out of with quotes', () => {
    const header = contentDisposition('a".pdf; evil=1');

    expect(header.startsWith('attachment; filename="a_.pdf; evil=1";')).toBe(
      true,
    );
    expect(header).toContain(`filename*=UTF-8''a%22.pdf%3B%20evil%3D1`);
  });
});
