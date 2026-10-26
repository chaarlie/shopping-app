import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional } from '@nestjs-cls/transactional';
import { randomBytes } from 'node:crypto';
import { AdminRepository } from '../../repositories/admin.repository.js';
import { dummyPasswordHash, verifyPassword } from '../../passwords.js';
import { SignInCommand, SignOutCommand } from '../session.command.js';

@CommandHandler(SignInCommand)
export class SignInCommandHandler implements ICommandHandler<SignInCommand> {
  constructor(private readonly admins: AdminRepository) {}
  @Transactional()
  async execute({ input }: SignInCommand) {
    const found = await this.admins.findEmail(input.email);
    const valid = await verifyPassword(
      input.password,
      found?.password_hash ?? dummyPasswordHash,
    );
    if (!valid || !found) {
      return null;
    }
    const token = randomBytes(32).toString('hex');
    await this.admins.createSession(token, found.id);
    return {
      token,
      admin: { id: found.id, name: found.name, email: found.email },
    };
  }
}
@CommandHandler(SignOutCommand)
export class SignOutCommandHandler implements ICommandHandler<SignOutCommand> {
  constructor(private readonly admins: AdminRepository) {}
  @Transactional()
  async execute({ token }: SignOutCommand): Promise<void> {
    await this.admins.deleteSession(token);
  }
}
