'use strict';

var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};



const { Controller, Get, Put, Body, UseGuards } = require('@nestjs/common');
const { ApiTags, ApiOkResponse, ApiBearerAuth } = require('@nestjs/swagger');
const { SmsService } = require('./sms.service');
const { SMSSettingsDto } = require('./dto/sms-settings.dto');
const { RolesGuard } = require('../auth/guard/roles.guard');
const { Roles } = require('../auth/decorator/roles.decorator');
const { Role } = require('../user/schema/user.schema');

let SmsController = class SmsController {
    constructor(smsService) {
        this.smsService = smsService;
    }

    async getSettings() {
        return await this.smsService.getSettings();
    }

    async updateSettings(dto) {
        return await this.smsService.updateSettings(dto);
    }
};

__decorate([
    Get(),
    ApiOkResponse({ type: SMSSettingsDto }),
    ApiBearerAuth(),
    UseGuards(RolesGuard),
    Roles(Role.SuperAdmin, Role.Admin),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SmsController.prototype, "getSettings", null);

__decorate([
    Put(),
    ApiOkResponse({ description: 'SMS settings updated successfully' }),
    ApiBearerAuth(),
    UseGuards(RolesGuard),
    Roles(Role.SuperAdmin, Role.Admin),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SmsController.prototype, "updateSettings", null);

SmsController = __decorate([
    ApiTags('sms'),
    Controller('settings/sms'),
    __metadata("design:paramtypes", [SmsService])
], SmsController);

module.exports = { SmsController };
