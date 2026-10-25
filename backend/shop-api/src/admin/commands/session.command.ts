import { Command } from '@nestjs/cqrs';
import type { Admin, SignInInput } from '@shop/contracts';
export class SignInCommand extends Command<{
  admin: Admin;
  token: string;
} | null> {
  constructor(public readonly input: SignInInput) {
    super();
  }
}
export class SignOutCommand extends Command<void> {
  constructor(public readonly token: string) {
    super();
  }
}
