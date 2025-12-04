'use strict';

const { IsBoolean, IsString, IsOptional, ValidateNested } = require('class-validator');
const { Type } = require('class-transformer');
const { ApiProperty } = require('@nestjs/swagger');

class SMSTemplateDto {
    @ApiProperty({ required: true, default: false })
    @IsBoolean()
    enabled;

    @ApiProperty({ required: true, default: '' })
    @IsString()
    templateName;

    @ApiProperty({ type: 'object', default: {} })
    @IsOptional()
    tokens;
}

class SMSSettingsDto {
    @ApiProperty({ type: SMSTemplateDto })
    @ValidateNested()
    @Type(() => SMSTemplateDto)
    registration;

    @ApiProperty({ type: SMSTemplateDto })
    @ValidateNested()
    @Type(() => SMSTemplateDto)
    deposit;

    @ApiProperty({ type: SMSTemplateDto })
    @ValidateNested()
    @Type(() => SMSTemplateDto)
    withdrawal;

    @ApiProperty({ type: SMSTemplateDto })
    @ValidateNested()
    @Type(() => SMSTemplateDto)
    verifiedUsers;

    @ApiProperty({ type: SMSTemplateDto })
    @ValidateNested()
    @Type(() => SMSTemplateDto)
    unverifiedUsers;
}

module.exports = { SMSSettingsDto, SMSTemplateDto };
