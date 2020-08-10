import { SetParams } from './set-params';
import { GetQuery } from './get-query';

export interface SubscriptionParams {
    set: SetParams;
    get: GetQuery;
}
