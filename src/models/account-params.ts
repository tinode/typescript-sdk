import { DefAcs } from './defacs';

export interface AccountParams {
    /**
     * Default access parameters for user's me topic.
     */
    defacs: DefAcs;
    /**
     * Public application-defined data exposed on me topic.
     */
    public: any;
    /**
     * Private application-defined data accessible on me topic.
     */
    private: any;
    /**
     * array of string tags for user discovery
     */
    tags: string[];
    /**
     * authentication token to use.
     */
    token: string;
    cred: any;
}
