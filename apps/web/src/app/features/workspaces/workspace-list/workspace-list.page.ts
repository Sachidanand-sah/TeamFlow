import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { WORKSPACE_NAME_MAX_LENGTH, WorkspaceDto } from '@teamflow/shared';
import {
  ButtonComponent,
  colorFor,
  FormFieldComponent,
  IconComponent,
} from '@teamflow/ui';
import { httpErrorMessage } from '../../../core/http-error-message';
import { WorkspacesApi } from '../../../core/workspaces/workspaces.api';
import { RoleBadge } from '../role-badge';

/** Smart: loads the user's workspaces and creates new ones. */
@Component({
  selector: 'tf-workspace-list-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    FormFieldComponent,
    IconComponent,
    RoleBadge,
  ],
  templateUrl: './workspace-list.page.html',
  styleUrl: './workspace-list.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceListPage implements OnInit {
  private readonly api = inject(WorkspacesApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly colorFor = colorFor;

  protected readonly workspaces = signal<WorkspaceDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly creating = signal(false);
  protected readonly createError = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [
      '',
      [Validators.required, Validators.maxLength(WORKSPACE_NAME_MAX_LENGTH)],
    ],
  });

  ngOnInit(): void {
    this.api
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (workspaces) => {
          this.workspaces.set(workspaces);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loadError.set(httpErrorMessage(error));
          this.loading.set(false);
        },
      });
  }

  protected nameError(): string | null {
    const control = this.form.controls.name;
    if (!control.touched || control.valid) {
      return null;
    }
    return control.hasError('required')
      ? 'Give the workspace a name'
      : `Use at most ${WORKSPACE_NAME_MAX_LENGTH} characters`;
  }

  protected create(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.creating.set(true);
    this.createError.set(null);

    this.api.create(this.form.getRawValue().name).subscribe({
      next: (workspace) => {
        this.workspaces.update((list) =>
          [...list, workspace].sort((a, b) => a.name.localeCompare(b.name)),
        );
        this.form.reset();
        this.creating.set(false);
      },
      error: (error: unknown) => {
        this.createError.set(httpErrorMessage(error));
        this.creating.set(false);
      },
    });
  }
}
