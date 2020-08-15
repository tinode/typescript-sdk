export class Topic {
    tinode: any;
    name: string;
    maxSeq: number;
    minSeq: number;
    lastDescUpdate: any;
    lastSubsUpdate: any;
    constructor(a?: any) { }

    getType(): string {
        return '';
    }
}