import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DeduplicationService } from './deduplication.service';
import {
  IdempotencyKey,
  IdempotencyKeySchema,
} from './schemas/idempotency-key.schema';

const uri = process.env.MONGODB_URI;

@Global()
@Module({
  imports: uri
    ? [
        MongooseModule.forFeature([
          { name: IdempotencyKey.name, schema: IdempotencyKeySchema },
        ]),
      ]
    : [],
  providers: [DeduplicationService],
  exports: [DeduplicationService],
})
export class DeduplicationModule {}
