import { z } from 'zod';
import { adminProductsQuerySchema } from '@shop/contracts';
import { ListAdminProductsQuery } from '../../products/queries/list-admin-products.query.js';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ThrottlerGuard } from '@nestjs/throttler';
import { signInSchema, type SignInInput } from '@shop/contracts';
import type { Response } from 'express';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { Env } from '../../config/env.schema.js';
import {
  AdminAccessGuard,
  adminCookie,
  type AdminRequest,
  Public,
} from '../access.js';
import { SignInCommand, SignOutCommand } from '../commands/session.command.js';

@Controller('admin')
export class AdminRestController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
    private readonly config: ConfigService<Env, true>,
  ) {}
  @Public()
  @Post('sign-in')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  async signIn(
    @Body(new ZodValidationPipe(signInSchema)) input: SignInInput,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.commands.execute(new SignInCommand(input));
    if (!result) {
      throw new UnauthorizedException('Email or password is incorrect');
    }
    response.cookie(adminCookie, result.token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.config.get('ORDER_COOKIE_SECURE', { infer: true }),
      path: '/api',
      maxAge: 8 * 60 * 60 * 1000,
    });
    return result.admin;
  }
  @Get('products')
  products(
    @Query(new ZodValidationPipe(adminProductsQuerySchema))
    query: z.infer<typeof adminProductsQuerySchema>,
  ) {
    return this.queries.execute(
      new ListAdminProductsQuery(
        query.page,
        query.pageSize,
        query.q,
        query.reorder === 'true',
      ),
    );
  }
  @Get('session')
  session(@Req() req: AdminRequest) {
    return req.admin;
  }
  @Post('sign-out')
  @HttpCode(204)
  async signOut(
    @Req() req: AdminRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.commands.execute(
      new SignOutCommand(String(req.cookies[adminCookie])),
    );
    response.clearCookie(adminCookie, {
      path: '/api',
      httpOnly: true,
      sameSite: 'strict',
      secure: this.config.get('ORDER_COOKIE_SECURE', { infer: true }),
    });
  }
}
