import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';


//todo: quizas se podria revisar que estan los campos en el .env usando joi. 
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
})
export class AppConfigModule {}
