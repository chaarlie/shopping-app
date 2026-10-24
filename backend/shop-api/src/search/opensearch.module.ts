import {
  Global,
  Injectable,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@opensearch-project/opensearch';
import { Env } from '../config/env.schema.js';

const REQUEST_TIMEOUT_MS = 5000;

@Injectable()
class OpenSearchClientCloser implements OnApplicationShutdown {
  constructor(private readonly client: Client) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: Client,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Env, true>) =>
        new Client({
          node: configService.get('OPENSEARCH_URL', { infer: true }),
          requestTimeout: REQUEST_TIMEOUT_MS,
          maxRetries: 1,
        }),
    },
    OpenSearchClientCloser,
  ],
  exports: [Client],
})
export class OpenSearchModule {}
