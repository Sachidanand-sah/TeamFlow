import { TestBed } from '@angular/core/testing';
import { ButtonComponent } from './button';

describe('ButtonComponent', () => {
  function render(
    inputs: Partial<
      Record<'variant' | 'type' | 'disabled' | 'loading', unknown>
    > = {},
  ) {
    const fixture = TestBed.createComponent(ButtonComponent);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  }

  it('renders a primary, non-submitting button by default', () => {
    const button = render();

    expect(button.type).toBe('button');
    expect(button.classList).toContain('tf-button--primary');
    expect(button.disabled).toBe(false);
  });

  it('applies the requested variant and type', () => {
    const button = render({ variant: 'secondary', type: 'submit' });

    expect(button.classList).toContain('tf-button--secondary');
    expect(button.type).toBe('submit');
  });

  it('is disabled and busy while loading', () => {
    const button = render({ loading: true });

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.querySelector('.tf-button__spinner')).not.toBeNull();
  });
});
