/**
 * A packet that we can send to the server
 */
export class Packet<T> {
    readonly name: string;
    id: string;
    data: T;

    constructor(name: string, data: T, id: string) {
        this.name = name;
        this.data = data;
        this.id = id;
    }
}

export enum PacketTypes {
    Hi = 'hi',
    Acc = 'acc',
    Login = 'login',
    Sub = 'sub',
    Leave = 'leave',
    Pub = 'pub',
    Get = 'get',
    Set = 'set',
    Del = 'del',
    Note = 'note',
}
