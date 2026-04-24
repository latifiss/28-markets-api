"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const eventSchema = new mongoose_1.Schema({
    code: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    type: {
        type: String,
        required: true,
        enum: ['economic', 'earnings', 'dividend', 'ipo', 'treasury'],
    },
    actual: { type: String },
    forecast: { type: String },
    previous: { type: String },
    is_new: { type: Boolean, default: false },
    is_new_set_at: { type: Date },
    date: { type: Date, required: true },
    last_updated: { type: Date, default: Date.now },
    state: {
        type: String,
        enum: [
            'oversubscribed',
            'undersubscribed',
            'suspended',
            'beat',
            'missed',
            'met',
            'priced',
            'withdrawn',
            'delayed',
            'completed',
            'announced',
            'increased',
            'decreased',
        ],
    },
});
eventSchema.virtual('stateOptions').get(function () {
    const options = {
        treasury: ['oversubscribed', 'undersubscribed', 'suspended'],
        economic: ['beat', 'missed', 'met'],
        earnings: ['beat', 'missed', 'met'],
        ipo: ['priced', 'withdrawn', 'delayed', 'completed'],
        dividend: ['announced', 'increased', 'decreased', 'suspended'],
    };
    return options[this.type] || [];
});
eventSchema.pre('save', function (next) {
    if (this.isModified('is_new') && this.is_new === true) {
        this.is_new_set_at = new Date();
    }
    else if (this.isModified('is_new') && this.is_new === false) {
        this.is_new_set_at = null;
    }
});
eventSchema.statics.updateExpiredNewFlags = async function () {
    const now = new Date();
    const fourDaysAgo = new Date(now);
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
    const fourDaysAgoUTC = new Date(Date.UTC(fourDaysAgo.getUTCFullYear(), fourDaysAgo.getUTCMonth(), fourDaysAgo.getUTCDate(), 0, 0, 0, 0));
    const result = await this.updateMany({
        is_new: true,
        is_new_set_at: { $lte: fourDaysAgoUTC },
    }, {
        $set: { is_new: false },
        $unset: { is_new_set_at: 1 },
    });
    return result;
};
eventSchema.virtual('is_new_expires_in').get(function () {
    if (!this.is_new || !this.is_new_set_at)
        return null;
    const expiryDate = new Date(this.is_new_set_at);
    expiryDate.setDate(expiryDate.getDate() + 4);
    const now = new Date();
    const diffMs = expiryDate.getTime() - now.getTime();
    if (diffMs <= 0)
        return 'expired';
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${diffDays}d ${diffHours}h`;
});
const Event = mongoose_1.default.model('Event', eventSchema);
exports.default = Event;
//# sourceMappingURL=event.model.js.map