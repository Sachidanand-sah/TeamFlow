import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  hasAtLeastRole,
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_KEY_PATTERN,
  PROJECT_NAME_MAX_LENGTH,
  ProjectDto,
  suggestProjectKey,
  WorkspaceRole,
} from '@teamflow/shared';
import { ButtonComponent, FormFieldComponent } from '@teamflow/ui';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { httpErrorMessage } from '../../../core/http-error-message';
import { ProjectsApi } from '../../../core/projects/projects.api';

/**
 * Smart: the "Projects" block of a workspace page. Owns its own list and create form,
 * so the workspace page does not grow with every feature.
 */
@Component({
  selector: 'tf-projects-section',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    FormFieldComponent,
  ],
  templateUrl: './projects-section.html',
  styleUrl: './projects-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsSection implements OnInit {
  readonly workspaceId = input.required<string>();
  readonly role = input.required<WorkspaceRole>();

  private readonly api = inject(ProjectsApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly projects = signal<ProjectDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly creating = signal(false);
  protected readonly createError = signal<string | null>(null);
  protected readonly showForm = signal(false);
  protected readonly canCreate = computed(() =>
    hasAtLeastRole(this.role(), 'ADMIN'),
  );

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [
      '',
      [Validators.required, Validators.maxLength(PROJECT_NAME_MAX_LENGTH)],
    ],
    key: ['', [Validators.required, Validators.pattern(PROJECT_KEY_PATTERN)]],
    description: ['', [Validators.maxLength(PROJECT_DESCRIPTION_MAX_LENGTH)]],
  });

  private readonly workspaceId$ = toObservable(this.workspaceId);

  ngOnInit(): void {
    // The parent page reuses this component when you switch workspaces, so reload on
    // every workspaceId change; switchMap drops responses for the previous one.
    this.workspaceId$
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.loadError.set(null);
        }),
        switchMap((id) =>
          this.api.list(id).pipe(
            map((projects) => ({ projects })),
            catchError((error: unknown) => of({ error })),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if ('error' in result) {
          this.projects.set([]);
          this.loadError.set(httpErrorMessage(result.error));
        } else {
          this.projects.set(result.projects);
        }
        this.loading.set(false);
      });

    // Suggest a key from the name until the user types their own key.
    this.form.controls.name.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((name) => {
        if (!this.form.controls.key.dirty) {
          this.form.controls.key.setValue(suggestProjectKey(name));
        }
      });
  }

  protected fieldError(name: 'name' | 'key' | 'description'): string | null {
    const control = this.form.controls[name];
    if (!control.touched || control.valid) {
      return null;
    }
    if (control.hasError('required')) {
      return 'This field is required';
    }
    if (control.hasError('pattern')) {
      return '2-10 characters: a letter, then letters or digits (e.g. WEB)';
    }
    return 'Value is too long';
  }

  protected upperCaseKey(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.form.controls.key.setValue(input.value.toUpperCase());
  }

  protected create(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.creating.set(true);
    this.createError.set(null);

    const { name, key, description } = this.form.getRawValue();
    this.api
      .create(this.workspaceId(), {
        name,
        key,
        description: description.trim() || null,
      })
      .subscribe({
        next: (project) => {
          this.projects.update((list) =>
            [...list, project].sort((a, b) => a.name.localeCompare(b.name)),
          );
          this.form.reset();
          this.showForm.set(false);
          this.creating.set(false);
        },
        error: (error: unknown) => {
          this.createError.set(
            httpErrorMessage(error, {
              409: `The key ${key} is already used in this workspace.`,
              403: 'Only admins can create projects.',
            }),
          );
          this.creating.set(false);
        },
      });
  }
}
