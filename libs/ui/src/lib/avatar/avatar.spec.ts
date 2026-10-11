import { TestBed } from '@angular/core/testing';
import { AvatarComponent, colorFor, initialsOf } from './avatar';

describe('initialsOf', () => {
  it.each([
    ['Ana Sharma', 'AS'],
    ['ana', 'A'],
    ['  Mary Jane Watson ', 'MJ'],
    ['', ''],
  ])('%p -> %p', (name, expected) => {
    expect(initialsOf(name)).toBe(expected);
  });
});

describe('colorFor', () => {
  it('is stable for the same name', () => {
    expect(colorFor('Ana Sharma')).toBe(colorFor('Ana Sharma'));
  });
});

describe('AvatarComponent', () => {
  it('renders initials, a colour, and hides itself from screen readers', () => {
    const fixture = TestBed.createComponent(AvatarComponent);
    fixture.componentRef.setInput('name', 'Ana Sharma');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent?.trim()).toBe('AS');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.style.background).not.toBe('');
  });
});
