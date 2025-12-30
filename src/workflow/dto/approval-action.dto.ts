import { IsString, IsOptional, IsNotEmpty, MinLength } from 'class-validator';

export class ApprovalActionDto {
    @IsString()
    @IsOptional()
    comment?: string;
}

export class RejectDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(1)
    comment!: string;
}

export class RequestChangesDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(1)
    comment!: string;
}

export class CommentDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(1)
    comment!: string;
}
