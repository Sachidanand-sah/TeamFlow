import {
  CreateProjectRequest,
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_KEY_PATTERN,
  PROJECT_NAME_MAX_LENGTH,
  UpdateProjectRequest,
} from '@teamflow/shared';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateProjectDto implements CreateProjectRequest {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(PROJECT_NAME_MAX_LENGTH)
  name!: string;

  // Upper-cased for convenience, then validated strictly.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(PROJECT_KEY_PATTERN, {
    message:
      'key must be 2-10 characters: an uppercase letter followed by letters or digits',
  })
  key!: string;

  @IsOptional()
  @IsString()
  @MaxLength(PROJECT_DESCRIPTION_MAX_LENGTH)
  description?: string | null;
}

/**
 * No `key` property: with `forbidNonWhitelisted`, a request that tries to change the
 * key is rejected with 400 instead of being silently ignored.
 */
export class UpdateProjectDto implements UpdateProjectRequest {
  // Not @IsOptional: that would also accept `null`, and a project must keep a name.
  // ValidateIf skips validation only when the field is absent.
  @ValidateIf((dto: UpdateProjectDto) => dto.name !== undefined)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(PROJECT_NAME_MAX_LENGTH)
  name?: string;

  // @IsOptional also lets `null` through, which clears the description.
  @IsOptional()
  @IsString()
  @MaxLength(PROJECT_DESCRIPTION_MAX_LENGTH)
  description?: string | null;
}
