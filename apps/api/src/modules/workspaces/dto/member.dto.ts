import {
  AddMemberRequest,
  ASSIGNABLE_WORKSPACE_ROLES,
  AssignableWorkspaceRole,
  EMAIL_MAX_LENGTH,
  UpdateMemberRoleRequest,
} from '@teamflow/shared';
import { IsEmail, IsIn, MaxLength } from 'class-validator';

export class AddMemberDto implements AddMemberRequest {
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email!: string;

  // OWNER is not in the list: ownership can never be granted through this endpoint.
  @IsIn(ASSIGNABLE_WORKSPACE_ROLES)
  role!: AssignableWorkspaceRole;
}

export class UpdateMemberRoleDto implements UpdateMemberRoleRequest {
  @IsIn(ASSIGNABLE_WORKSPACE_ROLES)
  role!: AssignableWorkspaceRole;
}
