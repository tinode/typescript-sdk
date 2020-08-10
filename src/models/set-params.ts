import { DefAcs } from './defacs';

export interface SetDesc {
    defacs: DefAcs;
    public: any;
    private: any;
}

export interface SetSub {
    user: string;
    mode: string;
    info: any;
}

export interface SetParams {
    desc: SetDesc;
    sub: SetSub;
    tags: any;
}
