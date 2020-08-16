export class Topic {
    tinode: any;
    name: string;
    maxSeq: number;
    minSeq: number;
    maxDel: number;
    lastDescUpdate: any;
    lastSubsUpdate: any;
    constructor(a?: any) { }

    getType(): string {
        return '';
    }
}