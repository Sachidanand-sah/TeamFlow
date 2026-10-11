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
import { Router, RouterLink } from '@angular/router';
import {
  hasAtLeastRole,
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_NAME_MAX_LENGTH,
  ProjectDto,
  WorkspaceDto,
} from '@teamflow/shared';
import { ButtonComponent, FormFieldComponent } from '@teamflow/ui';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { httpErrorMessage } from '../../../core/http-error-message';
import { ProjectsApi } from '../../../core/projects/projects.api';
import { WorkspacesApi } from '../../../core/workspaces/workspaces.api';
import { ActivityFeed } from '../../activity/activity-feed';
import { TaskBoard } from '../../tasks/task-board/task-board';

/** Smart: one project's header and settings; the board is its own smart component. */
@Component({
  selector: 'tf-project-detail-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    FormFieldComponent,
    TaskBoard,
    ActivityFeed,
  ],
  templateUrl: './project-detail.page.html',
  styleUrl: './project-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectDetailPage implements OnInit {
  /** Route params, bound by withComponentInputBinding. */
  readonly workspaceId = input.required<string>();
  readonly projectId = input.required<string>();

  private readonly projectsApi = inject(ProjectsApi);
  private readonly workspacesApi = inject(WorkspacesApi);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly workspace = signal<WorkspaceDto | null>(null);
  protected readonly project = signal<ProjectDto | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly editing = signal(false);
  protected readonly busy = signal(false);
  protected readonly actionError = signal<string | null>(null);

  /** Hides admin actions; the API still enforces ADMIN on every write. */
  protected readonly canEdit = computed(() => {
    const ws = this.workspace();
    return ws !== null && hasAtLeastRole(ws.role, 'ADMIN');
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [
      '',
      [Validators.required, Validators.maxLength(PROJECT_NAME_MAX_LENGTH)],
    ],
    description: ['', [Validators.maxLength(PROJECT_DESCRIPTION_MAX_LENGTH)]],
  });

  // One computed for both ids: a route change emits once, never a mixed pair.
  private readonly ids$ = toObservable(
    computed(() => [this.workspaceId(), this.projectId()] as const),
  );

  ngOnInit(): void {
    this.ids$
      .pipe(
        switchMap(([workspaceId, projectId]) =>
          forkJoin({
            workspace: this.workspacesApi.get(workspaceId),
            project: this.projectsApi.get(workspaceId, projectId),
          }).pipe(
            map((loaded) => ({ loaded })),
            catchError((error: unknown) => of({ error })),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if ('error' in result) {
          this.project.set(null);
          this.loadError.set(
            httpErrorMessage(result.error, {
              404: 'This project does not exist or you do not have access to it.',
            }),
          );
          return;
        }
        this.workspace.set(result.loaded.workspace);
        this.project.set(result.loaded.project);
        this.loadError.set(null);
        this.editing.set(false);
      });
  }

  protected startEditing(): void {
    const project = this.project();
    if (!project) {
      return;
    }
    this.form.reset({
      name: project.name,
      description: project.description ?? '',
    });
    this.actionError.set(null);
    this.editing.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, description } = this.form.getRawValue();
    this.busy.set(true);
    this.actionError.set(null);
    this.projectsApi
      .update(this.workspaceId(), this.projectId(), {
        name,
        description: description.trim() || null,
      })
      .subscribe({
        next: (project) => {
          this.project.set(project);
          this.editing.set(false);
          this.busy.set(false);
        },
        error: (error: unknown) => this.fail(error),
      });
  }

  protected deleteProject(): void {
    const project = this.project();
    if (
      !project ||
      !confirm(
        `Delete project ${project.key} "${project.name}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    this.busy.set(true);
    this.projectsApi.delete(this.workspaceId(), this.projectId()).subscribe({
      next: () =>
        void this.router.navigate(['/workspaces', this.workspaceId()]),
      error: (error: unknown) => this.fail(error),
    });
  }

  protected nameError(): string | null {
    const control = this.form.controls.name;
    if (!control.touched || control.valid) {
      return null;
    }
    return control.hasError('required')
      ? 'This field is required'
      : `Use at most ${PROJECT_NAME_MAX_LENGTH} characters`;
  }

  private fail(error: unknown): void {
    this.actionError.set(
      httpErrorMessage(error, {
        403: 'Only admins can change projects.',
        404: 'This project no longer exists.',
      }),
    );
    this.busy.set(false);
  }
}
