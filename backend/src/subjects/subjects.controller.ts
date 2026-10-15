import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { SubjectsService } from './subjects.service';
import { ContentService } from './content.service';
import {
  AccessRequestDto,
  AddMembersDto,
  CategoryDto,
  ContentEditDto,
  CreateNodeDto,
  CreateSubjectDto,
  ListSubjectsQuery,
  PreviewDto,
  ReorderDto,
  ReviewDto,
  UpdateMemberDto,
  UpdateSettingsDto,
} from './dto/subject.dto';

@Controller('api/subjects')
@UseGuards(JwtAuthGuard)
export class SubjectsController {
  constructor(
    private subjects: SubjectsService,
    private content: ContentService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ListSubjectsQuery) {
    return this.subjects.list(user, q);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSubjectDto) {
    return this.subjects.create(user, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.subjects.get(user, id);
  }

  /** Title / summary / body — goes through approval for editors. */
  @Put(':id')
  editContent(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() { changeNote, ...fields }: ContentEditDto,
  ) {
    return this.content.submit(user, id, null, 'UPDATE', fields, changeNote);
  }

  @Patch(':id/settings')
  updateSettings(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.subjects.updateSettings(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.subjects.remove(user, id);
  }

  // ---- nodes

  @Post(':id/nodes')
  createNode(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() { changeNote, ...payload }: CreateNodeDto,
  ) {
    return this.content.submit(user, id, null, 'CREATE', payload, changeNote);
  }

  @Post(':id/nodes/reorder')
  reorder(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReorderDto,
  ) {
    return this.content.reorder(user, id, dto.parentId ?? null, dto.orderedIds);
  }

  @Get(':id/nodes/:nodeId')
  getNode(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('nodeId') nodeId: string,
  ) {
    return this.content.getNode(user, id, nodeId);
  }

  @Put(':id/nodes/:nodeId')
  editNode(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('nodeId') nodeId: string,
    @Body() { changeNote, ...fields }: ContentEditDto,
  ) {
    return this.content.submit(user, id, nodeId, 'UPDATE', fields, changeNote);
  }

  @Delete(':id/nodes/:nodeId')
  deleteNode(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('nodeId') nodeId: string,
    @Query('note') note?: string,
  ) {
    return this.content.submit(user, id, nodeId, 'DELETE', {}, note);
  }

  @Patch(':id/nodes/:nodeId/preview')
  setPreview(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('nodeId') nodeId: string,
    @Body() dto: PreviewDto,
  ) {
    return this.content.setPreview(user, id, nodeId, dto.isPreview);
  }

  // ---- changes, revisions, trash

  @Get(':id/changes')
  changes(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('status') status?: string,
  ) {
    return this.content.listChanges(user, id, status);
  }

  @Get(':id/revisions')
  revisions(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('nodeId') nodeId?: string,
  ) {
    return this.content.listRevisions(user, id, nodeId);
  }

  @Get(':id/trash')
  trash(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.content.listTrash(user, id);
  }

  // ---- members & access requests

  @Get(':id/members')
  members(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.subjects.listMembers(user, id);
  }

  @Post(':id/members')
  addMembers(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddMembersDto,
  ) {
    return this.subjects.addMembers(
      user,
      id,
      dto.usernames,
      dto.role ?? 'VIEWER',
    );
  }

  @Patch(':id/members/:userId')
  updateMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.subjects.updateMember(user, id, userId, dto.role);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.subjects.removeMember(user, id, userId);
  }

  @Post(':id/access-requests')
  requestAccess(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AccessRequestDto,
  ) {
    return this.subjects.requestAccess(user, id, dto.message);
  }

  @Get(':id/access-requests')
  accessRequests(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('status') status?: string,
  ) {
    return this.subjects.listAccessRequests(user, id, status);
  }
}

@Controller('api')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(
    private subjects: SubjectsService,
    private content: ContentService,
  ) {}

  @Post('changes/:id/approve')
  approveChange(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewDto,
  ) {
    return this.content.reviewChange(user, id, true, dto.note);
  }

  @Post('changes/:id/reject')
  rejectChange(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewDto,
  ) {
    return this.content.reviewChange(user, id, false, dto.note);
  }

  @Post('revisions/:id/restore')
  restore(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.content.restoreRevision(user, id);
  }

  @Post('access-requests/:id/approve')
  approveAccess(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.subjects.decideAccessRequest(user, id, true);
  }

  @Post('access-requests/:id/reject')
  rejectAccess(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.subjects.decideAccessRequest(user, id, false);
  }
}

@Controller('api/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(private subjects: SubjectsService) {}

  @Get()
  list() {
    return this.subjects.listCategories();
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CategoryDto) {
    return this.subjects.createCategory(dto.name, dto.description);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.subjects.deleteCategory(id);
  }
}
