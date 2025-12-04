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

const { Prop, Schema, SchemaFactory } = require('@nestjs/mongoose');

let SMSTemplate = class SMSTemplate {};

__decorate([
    Prop({ required: true, default: false }),
    __metadata("design:type", Boolean)
], SMSTemplate.prototype, "enabled", void 0);

__decorate([
    Prop({ required: true, default: '' }),
    __metadata("design:type", String)
], SMSTemplate.prototype, "templateName", void 0);

__decorate([
    Prop({ type: Object, default: {} }),
    __metadata("design:type", Object)
], SMSTemplate.prototype, "tokens", void 0);

SMSTemplate = __decorate([
    Schema({ versionKey: false, _id: false })
], SMSTemplate);

const SMSTemplateSchema = SchemaFactory.createForClass(SMSTemplate);

let SMSSettings = class SMSSettings {};

__decorate([
    Prop({ type: SMSTemplateSchema, required: true }),
    __metadata("design:type", Object)
], SMSSettings.prototype, "registration", void 0);

__decorate([
    Prop({ type: SMSTemplateSchema, required: true }),
    __metadata("design:type", Object)
], SMSSettings.prototype, "deposit", void 0);

__decorate([
    Prop({ type: SMSTemplateSchema, required: true }),
    __metadata("design:type", Object)
], SMSSettings.prototype, "withdrawal", void 0);

__decorate([
    Prop({ type: SMSTemplateSchema, required: true }),
    __metadata("design:type", Object)
], SMSSettings.prototype, "verifiedUsers", void 0);

__decorate([
    Prop({ type: SMSTemplateSchema, required: true }),
    __metadata("design:type", Object)
], SMSSettings.prototype, "unverifiedUsers", void 0);

SMSSettings = __decorate([
    Schema({ versionKey: false })
], SMSSettings);

const SMSSettingsSchema = SchemaFactory.createForClass(SMSSettings);

module.exports = {
    SMSSettings,
    SMSSettingsSchema,
    SMSTemplate,
    SMSTemplateSchema
};
