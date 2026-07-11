import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AppController } from "./app.controller";
import { CompanyEntity, CompanySchema } from "./Company/company.entity";
import { UserEntity, UserSchema } from "./User/user.entity";
import { UserService } from "./User/user.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),

    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>("MONGODB_URI") ?? "mongodb://127.0.0.1:27017/email-task-automation",
      }),
    }),

    MongooseModule.forFeature([
      { name: CompanyEntity.name, schema: CompanySchema },
      { name: UserEntity.name, schema: UserSchema },
    ]),
  ],
  controllers: [AppController],
  providers: [UserService],
})
export class AppModule {}
