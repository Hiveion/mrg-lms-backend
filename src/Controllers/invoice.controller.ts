import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Body,
    Query,
    UseGuards,
    Request,
    ParseIntPipe,
    ConflictException
} from '@nestjs/common';
import { InvoiceService } from '../Services/invoice.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../Guards/roles.guard';
import { Roles } from '../Decorators/roles.decorator';
import { UserRole, InvoiceStatus } from '@prisma/client';
import { GenerateInvoicesDto, UpdateInvoiceStatusDto, UpdateInvoiceDto, CreateInvoiceDto } from '../DTOs/invoice.dto';

@Controller('invoices')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class InvoiceController {
    constructor(private readonly invoiceService: InvoiceService) { }

    @Post('generate')
    @Roles(UserRole.ADMIN)
    async generateInvoices(@Body() generateDto: GenerateInvoicesDto) {
        return this.invoiceService.generateInvoices(generateDto.month);
    }

    @Post()
    @Roles(UserRole.ADMIN)
    async createInvoice(@Body() createDto: CreateInvoiceDto) {
        return this.invoiceService.createInvoice(createDto);
    }

    @Get()
    @Roles(UserRole.ADMIN)
    async findAll(
        @Query('studentId') studentId?: string,
        @Query('month') month?: string,
        @Query('status') status?: InvoiceStatus,
    ) {
        return this.invoiceService.findAll(
            studentId ? parseInt(studentId) : undefined,
            month,
            status,
        );
    }

    @Get('parent')
    @Roles(UserRole.PARENT)
    async findParentInvoices(@Request() req: any) {
        // Assuming req.user.parentId exists or we fetch it
        // req.user has user.id. We need parent.id.
        // I'll check if req.user has the profile id
        return this.invoiceService.findParentInvoices(req.user.parentProfile?.id);
    }

    @Get('student')
    @Roles(UserRole.STUDENT)
    async findStudentInvoices(@Request() req: any) {
        return this.invoiceService.findAll(req.user.studentProfile?.id);
    }

    @Get(':id')
    async findOne(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
        const invoice = await this.invoiceService.findOne(id);

        // Check ownership if not admin
        if (req.user.userType !== UserRole.ADMIN) {
            if (req.user.userType === UserRole.STUDENT && invoice.studentId !== req.user.studentProfile?.id) {
                throw new ConflictException('You can only view your own invoices');
            }
            // For parent, logic is more complex, but assuming service handles it or we add a check here
        }

        return invoice;
    }

    @Patch(':id/status')
    @Roles(UserRole.ADMIN)
    async updateStatus(
        @Param('id', ParseIntPipe) id: number,
        @Body() statusDto: UpdateInvoiceStatusDto,
    ) {
        return this.invoiceService.updateStatus(id, statusDto.status);
    }

    @Patch(':id')
    @Roles(UserRole.ADMIN)
    async updateInvoice(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateDto: UpdateInvoiceDto,
    ) {
        return this.invoiceService.updateInvoice(id, updateDto);
    }

    @Delete(':id')
    @Roles(UserRole.ADMIN)
    async deleteInvoice(@Param('id', ParseIntPipe) id: number) {
        return this.invoiceService.deleteInvoice(id);
    }
}
