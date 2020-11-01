export class TopicMe {
    constructor(a?: any) { }

    getContact(a: any): any {
        return {
            online: false,
        };
    }

    setMsgReadRecv(contactName, what, seq, ts?) { }
    getMsgReadRecv(a, b): number { return 0 }
    routePres(a) { }
    processMetaSub(a: any) { }
}
