import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateProjectDto, UpdateProjectDto } from './project.dto';

// Mirrors the global ValidationPipe (transform, then validate).
function errorsFor<T extends object>(cls: new () => T, body: object): string[] {
  const dto = plainToInstance(cls, body);
  return validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).map(
    (e) => e.property,
  );
}

describe('CreateProjectDto', () => {
  it('accepts a valid project and upper-cases the key', () => {
    const dto = plainToInstance(CreateProjectDto, {
      name: ' Website ',
      key: 'web',
    });

    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.key).toBe('WEB');
    expect(dto.name).toBe('Website');
  });

  it.each(['W', '1WEB', 'WE B', 'TOOLONGKEY1'])('rejects key %p', (key) => {
    expect(errorsFor(CreateProjectDto, { name: 'X', key })).toContain('key');
  });

  it('rejects a blank name', () => {
    expect(errorsFor(CreateProjectDto, { name: '   ', key: 'WEB' })).toContain(
      'name',
    );
  });
});

describe('UpdateProjectDto', () => {
  it('accepts an empty patch', () => {
    expect(errorsFor(UpdateProjectDto, {})).toEqual([]);
  });

  it('accepts null to clear the description', () => {
    expect(errorsFor(UpdateProjectDto, { description: null })).toEqual([]);
  });

  it('rejects null as a name', () => {
    expect(errorsFor(UpdateProjectDto, { name: null })).toContain('name');
  });

  it('rejects attempts to change the key', () => {
    expect(errorsFor(UpdateProjectDto, { key: 'NEW' })).toContain('key');
  });
});
