'use strict';

var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};

const { Module } = require('@nestjs/common');
const { MongooseModule } = require('@nestjs/mongoose');
const { SmsController } = require('./sms.controller');
const { SmsService } = require('./sms.service');
const { SMSSettingsSchema } = require('./schema/sms-settings.schema');

let SmsModule = class SmsModule {};

SmsModule = __decorate([
    Module({
        imports: [
            MongooseModule.forFeature([
                { name: 'SMSSettings', schema: SMSSettingsSchema }
            ])
        ],  
        controllers: [SmsController],
        providers: [SmsService],
        exports: [SmsService]
    })
], SmsModule);

module.exports = { SmsModule };
