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
  ASSIGNABLE_WORKSPACE_ROLES,
  AssignableWorkspaceRole,
  canAssignRole,
  EMAIL_MAX_LENGTH,
  hasAtLeastRole,
  MemberDto,
  WORKSPACE_NAME_MAX_LENGTH,
  WorkspaceDto,
} from '@teamflow/shared';
import { ButtonComponent, FormFieldComponent } from '@teamflow/ui';
import { catchError, forkJoin, Observable, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { httpErrorMessage } from '../../../core/http-error-message';
import { WorkspacesApi } from '../../../core/workspaces/workspaces.api';
import { ProjectsSection } from '../../projects/projects-section/projects-section';
import { RoleBadge } from '../role-badge';
import { MemberList, RoleChange } from './member-list';

const MEMBER_ERRORS = {
  403: 'Your role does not allow this.',
  404: 'No TeamFlow account uses that email, or the member no longer exists.',
  409: 'That person is already a member.',
};

/** Smart: owns the workspace + member state and every action on them. */
@Component({
  selector: 'tf-workspace-detail-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    FormFieldComponent,
    MemberList,
    ProjectsSection,
    RoleBadge,
  ],
  templateUrl: './workspace-detail.page.html',
  styleUrl: './workspace-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceDetailPage implements OnInit {
  /** Bound from the `:workspaceId` route parameter (withComponentInputBinding). */
  readonly workspaceId = input.required<string>();

  private readonly api = inject(WorkspacesApi);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  protected readonly currentUserId = computed(
    () => this.auth.user()?.id ?? null,
  );

  protected readonly workspace = signal<WorkspaceDto | null>(null);
  protected readonly members = signal<MemberDto[]>([]);
  protected readonly loadError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly actionError = signal<string | null>(null);

  protected readonly role = computed(() => this.workspace()?.role ?? 'VIEWER');
  protected readonly isAdmin = computed(() =>
    hasAtLeastRole(this.role(), 'ADMIN'),
  );
  protected readonly isOwner = computed(() => this.role() === 'OWNER');
  protected readonly assignableRoles = computed(() =>
    ASSIGNABLE_WORKSPACE_ROLES.filter((r) => canAssignRole(this.role(), r)),
  );

  protected readonly renameForm = this.fb.group({
    name: [
      '',
      [Validators.required, Validators.maxLength(WORKSPACE_NAME_MAX_LENGTH)],
    ],
  });
  protected readonly addForm = this.fb.group({
    email: [
      '',
      [
        Validators.required,
        Validators.email,
        Validators.maxLength(EMAIL_MAX_LENGTH),
      ],
    ],
    role: this.fb.control<AssignableWorkspaceRole>('MEMBER'),
  });

  // Field initializer, so it runs in the injection context toObservable needs.
  private readonly workspaceId$ = toObservable(this.workspaceId);

  ngOnInit(): void {
    // switchMap: navigating to another workspace cancels the previous load, so a
    // slow response can never overwrite the page with the wrong workspace.
    // The catchError sits INSIDE switchMap so one failed load does not end the stream.
    this.workspaceId$
      .pipe(
        switchMap((id) =>
          forkJoin({
            workspace: this.api.get(id),
            members: this.api.listMembers(id),
          }).pipe(catchError((error: unknown) => of({ error }))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if ('error' in result) {
          this.workspace.set(null);
          this.loadError.set(
            httpErrorMessage(result.error, {
              404: 'This workspace does not exist or you are not a member.',
            }),
          );
          return;
        }
        this.workspace.set(result.workspace);
        this.members.set(result.members);
        this.renameForm.reset({ name: result.workspace.name });
        this.loadError.set(null);
      });
  }

  protected rename(): void {
    if (this.renameForm.invalid) {
      this.renameForm.markAllAsTouched();
      return;
    }
    this.run(
      this.api.rename(this.workspaceId(), this.renameForm.getRawValue().name),
      (ws) => this.workspace.set(ws),
    );
  }

  protected addMember(): void {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }
    this.run(
      this.api.addMember(this.workspaceId(), this.addForm.getRawValue()),
      (member) => {
        this.members.update((list) => [...list, member]);
        this.addForm.reset({ email: '', role: 'MEMBER' });
      },
    );
  }

  protected changeRole({ userId, role }: RoleChange): void {
    this.run(this.api.changeRole(this.workspaceId(), userId, role), (updated) =>
      this.members.update((list) =>
        list.map((m) => (m.userId === userId ? updated : m)),
      ),
    );
  }

  protected removeMember(userId: string): void {
    this.run(this.api.removeMember(this.workspaceId(), userId), () =>
      this.members.update((list) => list.filter((m) => m.userId !== userId)),
    );
  }

  protected leave(): void {
    const userId = this.currentUserId();
    if (
      !userId ||
      !confirm('Leave this workspace? You will lose access to it.')
    ) {
      return;
    }
    this.run(
      this.api.removeMember(this.workspaceId(), userId),
      () => void this.router.navigateByUrl('/'),
    );
  }

  protected deleteWorkspace(): void {
    const name = this.workspace()?.name ?? 'this workspace';
    if (
      !confirm(`Delete "${name}" and everything in it? This cannot be undone.`)
    ) {
      return;
    }
    this.run(
      this.api.delete(this.workspaceId()),
      () => void this.router.navigateByUrl('/'),
    );
  }

  protected emailError(): string | null {
    const control = this.addForm.controls.email;
    if (!control.touched || control.valid) {
      return null;
    }
    return control.hasError('required')
      ? 'Email is required'
      : 'Enter a valid email address';
  }

  /** Runs one mutation at a time and shows a friendly error if it fails. */
  private run<T>(request: Observable<T>, onSuccess: (value: T) => void): void {
    this.busy.set(true);
    this.actionError.set(null);
    request.subscribe({
      next: (value) => {
        onSuccess(value);
        this.busy.set(false);
      },
      error: (error: unknown) => {
        this.actionError.set(httpErrorMessage(error, MEMBER_ERRORS));
        this.busy.set(false);
      },
    });
  }
}
