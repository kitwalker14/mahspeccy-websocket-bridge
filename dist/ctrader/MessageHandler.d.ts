import { CTraderAccount, Position } from '../types';
export declare class MessageHandler {
    private root;
    private ProtoOAPayloadType;
    private ProtoPayloadType;
    private ProtoMessage;
    private ProtoOAApplicationAuthReq;
    private ProtoOAApplicationAuthRes;
    private ProtoOAAccountAuthReq;
    private ProtoOAAccountAuthRes;
    private ProtoOAVersionReq;
    private ProtoOAVersionRes;
    private ProtoOAExecutionEvent;
    private ProtoOASpotEvent;
    private ProtoHeartbeatEvent;
    private ProtoErrorRes;
    private ProtoOAErrorRes;
    private ProtoOANewOrderReq;
    private ProtoOAClosePositionReq;
    private ProtoOAReconcileReq;
    private ProtoOAReconcileRes;
    initialize(): Promise<void>;
    createApplicationAuthRequest(clientId: string, clientSecret: string): Buffer;
    createAccountAuthRequest(accessToken: string, ctidTraderAccountId: string): Buffer;
    createVersionRequest(): Buffer;
    createHeartbeatEvent(): Buffer;
    createReconcileRequest(ctidTraderAccountId: string): Buffer;
    createNewOrderRequest(ctidTraderAccountId: string, symbolId: number, orderType: number, tradeSide: number, volume: number, stopLoss?: number, takeProfit?: number, comment?: string): Buffer;
    createClosePositionRequest(ctidTraderAccountId: string, positionId: string, volume: number): Buffer;
    decodeMessage(data: Buffer): {
        type: string;
        payload: any;
    } | null;
    private getPayloadTypeName;
    extractAccountInfo(reconcileRes: any): CTraderAccount | null;
    extractPositions(reconcileRes: any): Position[];
}
