import {
    Controller,
    Get,
    Post,
    Patch,
    Param,
    Body,
    Query,
    UseGuards,
    ParseIntPipe,
    Request,
    UseInterceptors,
    UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PayoutService } from '../Services/payout.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../Guards/roles.guard';
import { Roles } from '../Decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { GeneratePayoutsDto } from '../DTOs/payout.dto';

@Controller('payouts')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PayoutController {
    constructor(private readonly payoutService: PayoutService) { }

    @Post('generate')
    @Roles(UserRole.ADMIN)
    async generatePayouts(@Body() generateDto: GeneratePayoutsDto) {
        return this.payoutService.generatePayouts(generateDto.month, generateDto.tutorId);
    }

    @Get('preview')
    @Roles(UserRole.ADMIN)
    async previewPayouts(@Query('month') month: string) {
        return this.payoutService.previewPayouts(month);
    }

    @Get()
    @Roles(UserRole.ADMIN)
    async findAll(@Query('month') month?: string) {
        return this.payoutService.findAll(month);
    }

    @Patch(':id/status')
    @Roles(UserRole.ADMIN)
    @UseInterceptors(FileInterceptor('file'))
    async updateStatus(
        @Param('id', ParseIntPipe) id: number,
        @Request() req: any,
        @Body() body: any,
        @UploadedFile() file?: any
    ) {
        console.log('=== PayoutController.updateStatus ===');
        console.log('body:', body);
        console.log('file:', file ? { originalname: file.originalname, size: file.size } : 'undefined');

        const additionalAmount = body.additionalAmount ? parseFloat(body.additionalAmount) : undefined;
        const discount = body.discount ? parseFloat(body.discount) : undefined;
        return this.payoutService.updateStatus(id, req.user.id, {
            status: body.status,
            transactionReference: body.transactionReference,
            additionalAmount,
            discount,
            notes: body.notes,
            file,
        });
    }
}
