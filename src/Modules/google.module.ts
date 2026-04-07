
import { Module } from '@nestjs/common';
import { GoogleService } from '../Services/google.service';

@Module({
    providers: [GoogleService],
    exports: [GoogleService],
})
export class GoogleModule { }
