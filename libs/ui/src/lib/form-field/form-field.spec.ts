import { TestBed } from '@angular/core/testing';
import { FormFieldComponent } from './form-field';

describe('FormFieldComponent', () => {
  function render(error: string | null = null) {
    const fixture = TestBed.createComponent(FormFieldComponent);
    fixture.componentRef.setInput('label', 'Email');
    fixture.componentRef.setInput('for', 'email');
    fixture.componentRef.setInput('error', error);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('links the label to the control id', () => {
    const label = render().querySelector('label');

    expect(label?.textContent?.trim()).toBe('Email');
    expect(label?.getAttribute('for')).toBe('email');
  });

  it('shows no error by default', () => {
    expect(render().querySelector('[role="alert"]')).toBeNull();
  });

  it('shows the error with an id the control can reference', () => {
    const error = render('Email is required').querySelector('[role="alert"]');

    expect(error?.textContent?.trim()).toBe('Email is required');
    expect(error?.id).toBe('email-error');
  });
});
