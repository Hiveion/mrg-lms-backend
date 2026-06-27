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
} from '@nestjs/common';
import { PayoutService } from '../Services/payout.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../Guards/roles.guard';
import { Roles } from '../Decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { GeneratePayoutsDto, UpdatePayoutStatusDto } from '../DTOs/payout.dto';

@Controller('payouts')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PayoutController {
    constructor(private readonly payoutService: PayoutService) { }

    @Post('generate')
    @Roles(UserRole.ADMIN)
    async generatePayouts(@Body() generateDto: GeneratePayoutsDto) {
        return this.payoutService.generatePayouts(generateDto.month);
    }

    @Get()
    @Roles(UserRole.ADMIN)
    async findAll(@Query('month') month?: string) {
        return this.payoutService.findAll(month);
    }

    @Patch(':id/status')
    @Roles(UserRole.ADMIN)
    async updateStatus(
        @Param('id', ParseIntPipe) id: number,
        @Body() statusDto: UpdatePayoutStatusDto,
    ) {
        return this.payoutService.updateStatus(id, statusDto.status, statusDto.transactionReference);
    }
}
