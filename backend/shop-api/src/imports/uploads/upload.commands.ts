import type { StartImportUpload } from '@shop/contracts';
export class StartUploadCommand {
  constructor(
    readonly adminId: number,
    readonly input: StartImportUpload,
  ) {}
}
export class CompleteUploadCommand {
  constructor(
    readonly adminId: number,
    readonly id: string,
  ) {}
}
export class CancelUploadCommand {
  constructor(
    readonly adminId: number,
    readonly id: string,
  ) {}
}
