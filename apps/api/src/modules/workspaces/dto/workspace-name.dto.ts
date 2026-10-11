import {
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  WORKSPACE_NAME_MAX_LENGTH,
} from '@teamflow/shared';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateWorkspaceDto implements CreateWorkspaceRequest {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(WORKSPACE_NAME_MAX_LENGTH)
  name!: string;
}

export class UpdateWorkspaceDto implements UpdateWorkspaceRequest {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(WORKSPACE_NAME_MAX_LENGTH)
  name!: string;
}
