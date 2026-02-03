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
exports.MessageHandler = void 0;
const protobuf = __importStar(require("protobufjs"));
const path_1 = require("path");
const logger_1 = require("../logger");
class MessageHandler {
    root = null;
    ProtoOAPayloadType;
    ProtoPayloadType;
    ProtoMessage;
    ProtoOAApplicationAuthReq;
    ProtoOAApplicationAuthRes;
    ProtoOAAccountAuthReq;
    ProtoOAAccountAuthRes;
    ProtoOAVersionReq;
    ProtoOAVersionRes;
    ProtoOAExecutionEvent;
    ProtoOASpotEvent;
    ProtoHeartbeatEvent;
    ProtoErrorRes;
    ProtoOAErrorRes;
    ProtoOANewOrderReq;
    ProtoOAClosePositionReq;
    ProtoOAReconcileReq;
    ProtoOAReconcileRes;
    async initialize() {
        try {
            const protoPath = (0, path_1.resolve)(__dirname, './proto');
            this.root = new protobuf.Root();
            // Load proto files in correct dependency order
            await this.root.load([
                (0, path_1.resolve)(protoPath, 'OpenApiCommonModelMessages.proto'),
                (0, path_1.resolve)(protoPath, 'OpenApiModelMessages.proto'),
                (0, path_1.resolve)(protoPath, 'OpenApiCommonMessages.proto'),
                (0, path_1.resolve)(protoPath, 'OpenApiMessages.proto'),
            ]);
            this.ProtoPayloadType = this.root.lookupEnum('ProtoPayloadType');
            this.ProtoOAPayloadType = this.root.lookupEnum('ProtoOAPayloadType');
            this.ProtoMessage = this.root.lookupType('ProtoMessage');
            this.ProtoOAApplicationAuthReq = this.root.lookupType('ProtoOAApplicationAuthReq');
            this.ProtoOAApplicationAuthRes = this.root.lookupType('ProtoOAApplicationAuthRes');
            this.ProtoOAAccountAuthReq = this.root.lookupType('ProtoOAAccountAuthReq');
            this.ProtoOAAccountAuthRes = this.root.lookupType('ProtoOAAccountAuthRes');
            this.ProtoOAVersionReq = this.root.lookupType('ProtoOAVersionReq');
            this.ProtoOAVersionRes = this.root.lookupType('ProtoOAVersionRes');
            this.ProtoOAExecutionEvent = this.root.lookupType('ProtoOAExecutionEvent');
            this.ProtoOASpotEvent = this.root.lookupType('ProtoOASpotEvent');
            this.ProtoHeartbeatEvent = this.root.lookupType('ProtoHeartbeatEvent');
            this.ProtoErrorRes = this.root.lookupType('ProtoErrorRes');
            this.ProtoOAErrorRes = this.root.lookupType('ProtoOAErrorRes');
            this.ProtoOANewOrderReq = this.root.lookupType('ProtoOANewOrderReq');
            this.ProtoOAClosePositionReq = this.root.lookupType('ProtoOAClosePositionReq');
            this.ProtoOAReconcileReq = this.root.lookupType('ProtoOAReconcileReq');
            this.ProtoOAReconcileRes = this.root.lookupType('ProtoOAReconcileRes');
            logger_1.logger.info('Protobuf messages initialized successfully');
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Failed to initialize protobuf messages');
            throw new Error('Protobuf initialization failed');
        }
    }
    createApplicationAuthRequest(clientId, clientSecret) {
        const payload = this.ProtoOAApplicationAuthReq.create({
            clientId,
            clientSecret,
        });
        const payloadBytes = this.ProtoOAApplicationAuthReq.encode(payload).finish();
        const message = this.ProtoMessage.create({
            payloadType: this.ProtoOAPayloadType.values.PROTO_OA_APPLICATION_AUTH_REQ,
            payload: payloadBytes,
        });
        const messageBytes = this.ProtoMessage.encode(message).finish();
        const lengthBuffer = Buffer.allocUnsafe(4);
        lengthBuffer.writeUInt32BE(messageBytes.length, 0);
        return Buffer.concat([lengthBuffer, Buffer.from(messageBytes)]);
    }
    createAccountAuthRequest(accessToken, ctidTraderAccountId) {
        const payload = this.ProtoOAAccountAuthReq.create({
            accessToken,
            ctidTraderAccountId,
        });
        const payloadBytes = this.ProtoOAAccountAuthReq.encode(payload).finish();
        const message = this.ProtoMessage.create({
            payloadType: this.ProtoOAPayloadType.values.PROTO_OA_ACCOUNT_AUTH_REQ,
            payload: payloadBytes,
        });
        const messageBytes = this.ProtoMessage.encode(message).finish();
        const lengthBuffer = Buffer.allocUnsafe(4);
        lengthBuffer.writeUInt32BE(messageBytes.length, 0);
        return Buffer.concat([lengthBuffer, Buffer.from(messageBytes)]);
    }
    createVersionRequest() {
        const payload = this.ProtoOAVersionReq.create({});
        const payloadBytes = this.ProtoOAVersionReq.encode(payload).finish();
        const message = this.ProtoMessage.create({
            payloadType: this.ProtoOAPayloadType.values.PROTO_OA_VERSION_REQ,
            payload: payloadBytes,
        });
        const messageBytes = this.ProtoMessage.encode(message).finish();
        const lengthBuffer = Buffer.allocUnsafe(4);
        lengthBuffer.writeUInt32BE(messageBytes.length, 0);
        return Buffer.concat([lengthBuffer, Buffer.from(messageBytes)]);
    }
    createHeartbeatEvent() {
        const payload = this.ProtoHeartbeatEvent.create({});
        const payloadBytes = this.ProtoHeartbeatEvent.encode(payload).finish();
        const message = this.ProtoMessage.create({
            payloadType: this.ProtoPayloadType.values.HEARTBEAT_EVENT,
            payload: payloadBytes,
        });
        const messageBytes = this.ProtoMessage.encode(message).finish();
        const lengthBuffer = Buffer.allocUnsafe(4);
        lengthBuffer.writeUInt32BE(messageBytes.length, 0);
        return Buffer.concat([lengthBuffer, Buffer.from(messageBytes)]);
    }
    createReconcileRequest(ctidTraderAccountId) {
        const payload = this.ProtoOAReconcileReq.create({
            ctidTraderAccountId,
        });
        const payloadBytes = this.ProtoOAReconcileReq.encode(payload).finish();
        const message = this.ProtoMessage.create({
            payloadType: this.ProtoOAPayloadType.values.PROTO_OA_RECONCILE_REQ,
            payload: payloadBytes,
        });
        const messageBytes = this.ProtoMessage.encode(message).finish();
        const lengthBuffer = Buffer.allocUnsafe(4);
        lengthBuffer.writeUInt32BE(messageBytes.length, 0);
        return Buffer.concat([lengthBuffer, Buffer.from(messageBytes)]);
    }
    createNewOrderRequest(ctidTraderAccountId, symbolId, orderType, tradeSide, volume, stopLoss, takeProfit, comment) {
        const payload = this.ProtoOANewOrderReq.create({
            ctidTraderAccountId,
            symbolId,
            orderType,
            tradeSide,
            volume,
            stopLoss,
            takeProfit,
            comment,
        });
        const payloadBytes = this.ProtoOANewOrderReq.encode(payload).finish();
        const message = this.ProtoMessage.create({
            payloadType: this.ProtoOAPayloadType.values.PROTO_OA_NEW_ORDER_REQ,
            payload: payloadBytes,
        });
        const messageBytes = this.ProtoMessage.encode(message).finish();
        const lengthBuffer = Buffer.allocUnsafe(4);
        lengthBuffer.writeUInt32BE(messageBytes.length, 0);
        return Buffer.concat([lengthBuffer, Buffer.from(messageBytes)]);
    }
    createClosePositionRequest(ctidTraderAccountId, positionId, volume) {
        const payload = this.ProtoOAClosePositionReq.create({
            ctidTraderAccountId,
            positionId,
            volume,
        });
        const payloadBytes = this.ProtoOAClosePositionReq.encode(payload).finish();
        const message = this.ProtoMessage.create({
            payloadType: this.ProtoOAPayloadType.values.PROTO_OA_CLOSE_POSITION_REQ,
            payload: payloadBytes,
        });
        const messageBytes = this.ProtoMessage.encode(message).finish();
        const lengthBuffer = Buffer.allocUnsafe(4);
        lengthBuffer.writeUInt32BE(messageBytes.length, 0);
        return Buffer.concat([lengthBuffer, Buffer.from(messageBytes)]);
    }
    decodeMessage(data) {
        try {
            const messageBytes = data.length > 4 ? data.slice(4) : data;
            const message = this.ProtoMessage.decode(messageBytes);
            const payloadTypeName = this.getPayloadTypeName(message.payloadType);
            if (!payloadTypeName) {
                logger_1.logger.warn({ payloadType: message.payloadType }, 'Unknown payload type');
                return null;
            }
            let decodedPayload = null;
            switch (payloadTypeName) {
                case 'PROTO_OA_APPLICATION_AUTH_RES':
                    decodedPayload = this.ProtoOAApplicationAuthRes.decode(message.payload);
                    break;
                case 'PROTO_OA_ACCOUNT_AUTH_RES':
                    decodedPayload = this.ProtoOAAccountAuthRes.decode(message.payload);
                    break;
                case 'PROTO_OA_VERSION_RES':
                    decodedPayload = this.ProtoOAVersionRes.decode(message.payload);
                    break;
                case 'PROTO_OA_EXECUTION_EVENT':
                    decodedPayload = this.ProtoOAExecutionEvent.decode(message.payload);
                    break;
                case 'PROTO_OA_SPOT_EVENT':
                    decodedPayload = this.ProtoOASpotEvent.decode(message.payload);
                    break;
                case 'HEARTBEAT_EVENT':
                    decodedPayload = this.ProtoHeartbeatEvent.decode(message.payload);
                    break;
                case 'ERROR_RES':
                    decodedPayload = this.ProtoErrorRes.decode(message.payload);
                    break;
                case 'PROTO_OA_ERROR_RES':
                    decodedPayload = this.ProtoOAErrorRes.decode(message.payload);
                    break;
                case 'PROTO_OA_RECONCILE_RES':
                    decodedPayload = this.ProtoOAReconcileRes.decode(message.payload);
                    break;
                default:
                    logger_1.logger.debug({ payloadTypeName }, 'Unhandled message type');
                    return { type: payloadTypeName, payload: message.payload };
            }
            return {
                type: payloadTypeName,
                payload: decodedPayload ? decodedPayload.toJSON() : null,
            };
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Failed to decode message');
            return null;
        }
    }
    getPayloadTypeName(payloadType) {
        // Check ProtoOAPayloadType first
        let entry = Object.entries(this.ProtoOAPayloadType.values).find(([_, value]) => value === payloadType);
        if (entry)
            return entry[0];
        // Then check ProtoPayloadType
        entry = Object.entries(this.ProtoPayloadType.values).find(([_, value]) => value === payloadType);
        return entry ? entry[0] : null;
    }
    extractAccountInfo(reconcileRes) {
        try {
            if (!reconcileRes.trader) {
                return null;
            }
            const trader = reconcileRes.trader;
            return {
                accountId: trader.ctidTraderAccountId?.toString() || '',
                balance: trader.balance / 100,
                equity: trader.balance / 100,
                margin: 0,
                freeMargin: trader.balance / 100,
                marginLevel: 0,
                currency: 'USD',
                leverage: trader.leverageInCents ? trader.leverageInCents / 100 : 100,
                broker: 'ctrader',
                environment: trader.isLive ? 'live' : 'demo',
            };
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Failed to extract account info');
            return null;
        }
    }
    extractPositions(reconcileRes) {
        try {
            if (!reconcileRes.position || reconcileRes.position.length === 0) {
                return [];
            }
            return reconcileRes.position.map((pos) => ({
                positionId: pos.positionId?.toString() || '',
                symbol: pos.tradeData?.symbolId?.toString() || '',
                volume: pos.tradeData?.volume || 0,
                entryPrice: pos.price / 100000,
                currentPrice: pos.price / 100000,
                profit: (pos.grossProfit || 0) / 100,
                swap: (pos.swap || 0) / 100,
                commission: (pos.commission || 0) / 100,
                side: pos.tradeData?.tradeSide === 1 ? 'buy' : 'sell',
                openTime: new Date(pos.tradeData?.openTimestamp || Date.now()),
                stopLoss: pos.stopLoss ? pos.stopLoss / 100000 : undefined,
                takeProfit: pos.takeProfit ? pos.takeProfit / 100000 : undefined,
            }));
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Failed to extract positions');
            return [];
        }
    }
}
exports.MessageHandler = MessageHandler;
//# sourceMappingURL=MessageHandler.js.map