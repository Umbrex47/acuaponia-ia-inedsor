import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ActuatorsModule } from '../actuators/actuators.module';
import { FeederController } from './feeder.controller';
import { FeederSchedulerService } from './feeder-scheduler.service';
import {
  FeederSchedule,
  FeederScheduleSchema,
} from './schemas/feeder-schedule.schema';

@Module({})
export class FeederModule {
  static forRoot(): DynamicModule {
    const uri = process.env.MONGODB_URI;
    const imports: NonNullable<DynamicModule['imports']> = [ActuatorsModule];

    if (uri) {
      imports.push(
        MongooseModule.forFeature([
          { name: FeederSchedule.name, schema: FeederScheduleSchema },
        ]),
      );
    }

    return {
      module: FeederModule,
      global: true,
      imports,
      controllers: [FeederController],
      providers: [FeederSchedulerService],
      exports: [FeederSchedulerService],
    };
  }
}
