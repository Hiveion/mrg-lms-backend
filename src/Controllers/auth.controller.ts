
import { Controller, Post, Body, UseGuards, Request, Get, HttpCode, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../Services/auth.service';
import { RegisterDto, LoginDto } from '../DTOs/auth.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(@Body() loginDto: LoginDto) {
        const user = await this.authService.validateUser(loginDto.email, loginDto.password);
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }
        return this.authService.login(user);
    }

    @Post('register')
    async register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto);
    }

    @UseGuards(AuthGuard('jwt'))
    @Get('profile')
    getProfile(@Request() req: any) {
        return req.user;
    }

    @Get('google')
    @UseGuards(AuthGuard('google'))
    async googleAuth(@Request() req: any) { }

    @Get('google/callback')
    @UseGuards(AuthGuard('google'))
    googleAuthRedirect(@Request() req: any) {
        return this.authService.googleLogin(req);
    }

    @Post('complete-registration')
    @UseGuards(AuthGuard('jwt')) // User must be logged in (even with incomplete status)
    async completeRegistration(@Request() req: any, @Body() body: any) {
        // req.user from JWT strategy. Sub is userId.
        // Note: JWT Strategy needs to ensure it passes through users even with INCOMPLETE status. 
        // Currently JWT strategy looks up user.
        return this.authService.completeRegistration(req.user.id, body);
    }
}
