import {
  CreateTaskRequest,
  MoveTaskRequest,
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TITLE_MAX_LENGTH,
  TaskPriority,
  TaskStatus,
  UpdateTaskRequest,
} from '@teamflow/shared';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateTaskDto implements CreateTaskRequest {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(TASK_TITLE_MAX_LENGTH)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(TASK_DESCRIPTION_MAX_LENGTH)
  description?: string | null;

  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: TaskStatus;

  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: TaskPriority;

  /** null or absent = unassigned. */
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;
}

/** No `status`: changing columns goes through /move so positions stay consistent. */
export class UpdateTaskDto implements UpdateTaskRequest {
  // ValidateIf instead of IsOptional: absent is fine, `null` is not (a title is required).
  @ValidateIf((dto: UpdateTaskDto) => dto.title !== undefined)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(TASK_TITLE_MAX_LENGTH)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(TASK_DESCRIPTION_MAX_LENGTH)
  description?: string | null;

  @ValidateIf((dto: UpdateTaskDto) => dto.priority !== undefined)
  @IsIn(TASK_PRIORITIES)
  priority?: TaskPriority;

  /** `null` unassigns. */
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;
}

export class MoveTaskDto implements MoveTaskRequest {
  @IsIn(TASK_STATUSES)
  status!: TaskStatus;

  @IsInt()
  @Min(0)
  @Max(100_000)
  index!: number;
}
