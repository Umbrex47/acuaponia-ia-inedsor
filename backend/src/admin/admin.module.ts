import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminController } from './admin.controller';
import { ReminderSchedulerService } from './reminder-scheduler.service';
import { AdminSettingsService } from './admin-settings.service';
import { AdminGuard } from './guards/admin.guard';
import {
  ScheduledReminder,
  ScheduledReminderSchema,
} from './schemas/scheduled-reminder.schema';
import {
  SystemSettings,
  SystemSettingsSchema,
} from './schemas/system-settings.schema';

const uri = process.env.MONGODB_URI;
const dynamicImports: any[] = [forwardRef(() => NotificationsModule)];

if (uri) {
  dynamicImports.push(
    MongooseModule.forFeature([
      { name: ScheduledReminder.name, schema: ScheduledReminderSchema },
      { name: SystemSettings.name, schema: SystemSettingsSchema },
    ]),
  );
}

@Module({
  imports: dynamicImports,
  controllers: [AdminController],
  providers: [ReminderSchedulerService, AdminSettingsService, AdminGuard],
  exports: [ReminderSchedulerService, AdminSettingsService],
})
export class AdminModule {}
