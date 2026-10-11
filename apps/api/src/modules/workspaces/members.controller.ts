import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { MemberDto } from '@teamflow/shared';
import { CurrentMember } from './decorators/current-member.decorator';
import { AddMemberDto, UpdateMemberRoleDto } from './dto/member.dto';
import {
  RequireWorkspaceRole,
  WorkspaceRoleGuard,
} from './guards/workspace-role.guard';
import { MembersService } from './members.service';
import { WorkspaceMember } from './workspace-member';

@UseGuards(WorkspaceRoleGuard)
@Controller('workspaces/:workspaceId/members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @RequireWorkspaceRole('VIEWER')
  @Get()
  list(@CurrentMember() member: WorkspaceMember): Promise<MemberDto[]> {
    return this.members.list(member);
  }

  @RequireWorkspaceRole('ADMIN')
  @Post()
  add(
    @CurrentMember() member: WorkspaceMember,
    @Body() dto: AddMemberDto,
  ): Promise<MemberDto> {
    return this.members.add(member, dto);
  }

  @RequireWorkspaceRole('ADMIN')
  @Patch(':userId')
  changeRole(
    @CurrentMember() member: WorkspaceMember,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<MemberDto> {
    return this.members.changeRole(member, userId, dto.role);
  }

  /** VIEWER minimum so anyone can leave; MembersService enforces who may remove whom. */
  @RequireWorkspaceRole('VIEWER')
  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentMember() member: WorkspaceMember,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.members.remove(member, userId);
  }
}
