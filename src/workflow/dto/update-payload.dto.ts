import { IsObject } from 'class-validator';

export class UpdatePayloadDto {
    @IsObject()
    payload!: Record<string, unknown>;
}
