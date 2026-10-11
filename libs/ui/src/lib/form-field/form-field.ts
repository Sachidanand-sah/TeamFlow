import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Label + projected control + optional hint/error, laid out consistently.
 *
 * Usage:
 *   <tf-form-field label="Email" for="email" [error]="emailError()">
 *     <input id="email" type="email" formControlName="email" />
 *   </tf-form-field>
 *
 * Give the input `[attr.aria-describedby]="'email-error'"` when an error can show,
 * so screen readers announce it. The error element id is `<for>-error`; the hint
 * id is `<for>-hint`. Project an element with the `tf-field-action` attribute to
 * show it at the right end of the label row (e.g. "Forgot password?").
 */
@Component({
  selector: 'tf-form-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tf-form-field__top">
      <label class="tf-form-field__label" [attr.for]="for()">{{
        label()
      }}</label>
      <ng-content select="[tf-field-action]" />
    </div>
    <ng-content />
    @if (error(); as message) {
      <p class="tf-form-field__error" [id]="for() + '-error'" role="alert">
        {{ message }}
      </p>
    } @else if (hint(); as text) {
      <p class="tf-form-field__hint" [id]="for() + '-hint'">{{ text }}</p>
    }
  `,
  styleUrl: './form-field.scss',
})
export class FormFieldComponent {
  readonly label = input.required<string>();
  /** id of the projected control, used for the label's `for` attribute. */
  readonly for = input.required<string>();
  readonly error = input<string | null>(null);
  readonly hint = input<string | null>(null);
}
