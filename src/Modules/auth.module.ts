
import { Module } from '@nestjs/common';
import { AuthService } from '../Services/auth.service';
import { AuthController } from '../Controllers/auth.controller';
import { UsersModule } from './users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from '../Strategies/jwt.strategy';
import { GoogleStrategy } from '../Strategies/google.strategy';

@Module({
    imports: [
        UsersModule,
        PassportModule,
        JwtModule.register({
            secret: process.env.JWT_SECRET!,
            signOptions: { expiresIn: '60m' },
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy, GoogleStrategy],
    exports: [AuthService],
})
export class AuthModule { }
