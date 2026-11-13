import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UsePipes,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { CreateUserUseCase } from '../../application/use-cases/create-user.use-case';
import { GetUserUseCase } from '../../application/use-cases/get-user.use-case';
import { UpdateUserUseCase } from '../../application/use-cases/update-user.use-case';
import { DeleteUserUseCase } from '../../application/use-cases/delete-user.use-case';
import { ListUsersUseCase } from '../../application/use-cases/list-users.use-case';
import {
  createUserSchema,
  CreateUserDto,
} from '../../application/dto/create-user.dto';
import {
  updateUserSchema,
  UpdateUserDto,
} from '../../application/dto/update-user.dto';
import {
  userQuerySchema,
  UserQueryDto,
} from '../../application/dto/user-query.dto';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import { UserPresenter } from '../presenters/user.presenter';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly getUserUseCase: GetUserUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    private readonly deleteUserUseCase: DeleteUserUseCase,
    private readonly listUsersUseCase: ListUsersUseCase,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @UsePipes(new ZodValidationPipe(createUserSchema))
  async create(@Body() dto: CreateUserDto) {
    const user = await this.createUserUseCase.execute(dto);
    return {
      message: 'Utilizador criado com sucesso',
      data: UserPresenter.toResponse(user),
    };
  }

  @Get()
  @UsePipes(new ZodValidationPipe(userQuerySchema))
  async list(@Query() query: UserQueryDto) {
    const result = await this.listUsersUseCase.execute(query);
    return {
      message: 'Utilizadores listados com sucesso',
      data: UserPresenter.toResponseCollection(result.data),
      meta: result.meta,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const user = await this.getUserUseCase.execute(id);
    return {
      message: 'Utilizador recuperado com sucesso',
      data: UserPresenter.toResponse(user),
    };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) dto: UpdateUserDto,
  ) {
    const user = await this.updateUserUseCase.execute(id, dto);
    return {
      message: 'Utilizador atualizado com sucesso',
      data: UserPresenter.toResponse(user),
    };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.deleteUserUseCase.execute(id);
    return {
      message: 'Utilizador removido com sucesso',
      data: null,
    };
  }
}
