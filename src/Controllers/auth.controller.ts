
import { Controller, Post, Body, UseGuards, Request, Get, Put, HttpCode, HttpStatus, UnauthorizedException, Res } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from '../Services/auth.service';
import { RegisterDto, LoginDto, ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto } from '../DTOs/auth.dto';
import { UpdateProfileDto } from '../DTOs/user.dto';
import { AuthGuard } from '@nestjs/passport';
import { GoogleAuthGuard } from '../Guards/google-auth.guard';
import { UserStatus } from '@prisma/client';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(@Body() loginDto: LoginDto) {
        // validateUser itself throws if deactive, or returns null if password incorrect
        const user = await this.authService.validateUser(loginDto.email, loginDto.password);
        if (!user) {
            throw new UnauthorizedException('Invalid email or password');
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
    @UseGuards(GoogleAuthGuard)
    async googleAuth(@Request() req: any) { }

    @Get('google/callback')
    @UseGuards(GoogleAuthGuard)
    async googleAuthRedirect(@Request() req: any, @Res() res: Response) {
        try {
            const result = await this.authService.googleLogin(req);
            const frontendUrl = process.env.FRONTEND_URL;
            res.redirect(
                `${frontendUrl}/auth/callback?token=${result.access_token}&status=${result.user.status}`
            );
        } catch (error) {
            const frontendUrl = process.env.FRONTEND_URL;
            res.redirect(`${frontendUrl}/auth?error=${encodeURIComponent(error.message)}`);
        }
    }

    @Post('complete-registration')
    @UseGuards(AuthGuard('jwt')) // User must be logged in (even with incomplete status)
    async completeRegistration(@Request() req: any, @Body() body: any) {
        // req.user from JWT strategy. Sub is userId.
        // Note: JWT Strategy needs to ensure it passes through users even with INCOMPLETE status. 
        // Currently JWT strategy looks up user.
        return this.authService.completeRegistration(req.user.id, body);
    }

    @Put('profile')
    @UseGuards(AuthGuard('jwt'))
    @HttpCode(HttpStatus.OK)
    async updateProfile(@Request() req: any, @Body() updateProfileDto: UpdateProfileDto) {
        // Update user profile with the provided data
        return this.authService.updateUserProfile(req.user.id, updateProfileDto);
    }

    @Post('change-password')
    @UseGuards(AuthGuard('jwt'))
    @HttpCode(HttpStatus.OK)
    async changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
        return this.authService.changePassword(req.user.id, dto.newPassword);
    }

    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    async forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.authService.forgotPassword(dto.email);
    }

    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    async resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authService.resetPassword(dto.token, dto.newPassword);
    }
}
