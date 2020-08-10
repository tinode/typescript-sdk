export interface GetOptsType {
    ims: Date;
    limit: number;
}

export interface GetDataType {
    since: number;
    before: number;
    limit: number;
}

export interface GetQuery {
    desc: GetOptsType;
    sub: GetOptsType;
    data: GetDataType;
}
