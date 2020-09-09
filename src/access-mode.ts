import { AccessModeFlags, AccessModePermissionsBITMASK } from './constants';

/**
 * Helper class for handling access mode.
 */
export class AccessMode {
    private given: number;
    private want: number;
    mode: number;

    constructor(acs?) {
        if (acs) {
            this.given = typeof acs.given === 'number' ? acs.given : AccessMode.decode(acs.given);
            this.want = typeof acs.want === 'number' ? acs.want : AccessMode.decode(acs.want);

            if (acs.mode) {
                if (typeof acs.mode === 'number') {
                    this.mode = acs.mode;
                } else {
                    this.mode = AccessMode.decode(acs.mode);
                }
            } else {
                this.mode = this.given & this.want;
            }
        }
    }

    /**
     * Parse string into an access mode value.
     * @param mode - Permission string
     */
    static decode(mode: string | number): number {
        if (!mode) {
            return null;
        } else if (typeof mode === 'number') {
            return mode & AccessModePermissionsBITMASK;
        } else if (mode === 'N' || mode === 'n') {
            return AccessModeFlags.NONE;
        }

        const bitmask = {
            J: AccessModeFlags.JOIN,
            R: AccessModeFlags.READ,
            W: AccessModeFlags.WRITE,
            P: AccessModeFlags.PRES,
            A: AccessModeFlags.APPROVE,
            S: AccessModeFlags.SHARE,
            D: AccessModeFlags.DELETE,
            O: AccessModeFlags.OWNER,
        };

        let m0 = AccessModeFlags.NONE;

        for (let i = 0; i < mode.length; i++) {
            const bit = bitmask[mode.charAt(i).toUpperCase()];
            if (!bit) {
                // Unrecognized bit, skip.
                continue;
            }
            m0 |= bit;
        }
        return m0;
    }

    /**
     * Convert numeric representation of the access mode into a string.
     * @param val - Permission number
     */
    static encode(val: number): string {
        if (val === null || val === AccessModeFlags.INVALID) {
            return null;
        } else if (val === AccessModeFlags.NONE) {
            return 'N';
        }

        const bitmask = ['J', 'R', 'W', 'P', 'A', 'S', 'D', 'O'];
        let res = '';
        for (let i = 0; i < bitmask.length; i++) {
            if ((val & (1 << i)) !== 0) {
                res = res + bitmask[i];
            }
        }
        return res;
    }

    /**
     * Update numeric representation of access mode with the new value. The value
     * is one of the following:
     *   - a string starting with '+' or '-' then the bits to add or remove, e.g. '+R-W' or '-PS'.
     *   - a new value of access mode
     * @param val - access mode value to update.
     * @param upd - update to apply to val.
     */
    static update(val: number, upd: string): number {
        if (!upd || typeof upd !== 'string') {
            return val;
        }

        let action = upd.charAt(0);
        if (action === '+' || action === '-') {
            let val0 = val;
            // Split delta-string like '+ABC-DEF+Z' into an array of parts including + and -.
            const parts = upd.split(/([-+])/);
            // Starting iteration from 1 because String.split() creates an array with the first empty element.
            // Iterating by 2 because we parse pairs +/- then data.
            for (let i = 1; i < parts.length - 1; i += 2) {
                action = parts[i];
                const m0 = AccessMode.decode(parts[i + 1]);
                if (m0 === AccessModeFlags.INVALID) {
                    return val;
                }
                if (m0 == null) {
                    continue;
                }
                if (action === '+') {
                    val0 |= m0;
                } else if (action === '-') {
                    val0 &= ~m0;
                }
            }
            val = val0;
        } else {
            // The string is an explicit new value 'ABC' rather than delta.
            const val0 = AccessMode.decode(upd);
            if (val0 !== AccessModeFlags.INVALID) {
                val = val0;
            }
        }

        return val;
    }

    /**
     * Bits present in a1 but missing in a2.
     * @param a1 - access mode to subtract from.
     * @param a2 - access mode to subtract.
     */
    static diff(a1: number | string, a2: number | string): number {
        a1 = AccessMode.decode(a1);
        a2 = AccessMode.decode(a2);

        if (a1 === AccessModeFlags.INVALID || a2 === AccessModeFlags.INVALID) {
            return AccessModeFlags.INVALID;
        }
        return a1 & ~a2;
    }

    static checkFlag(val: AccessMode, side: string, flag: AccessModeFlags): boolean {
        side = side || 'mode';
        if (['given', 'want', 'mode'].filter((s) => s === side).length) {
            return ((val[side] & flag) !== 0);
        }
        throw new Error('Invalid AccessMode component "' + side + '"');
    }

    /**
     * Assign value to 'mode'.
     * @param mode - either a string representation of the access mode or a set of bits.
     */
    setMode(mode: string | number): AccessMode {
        this.mode = AccessMode.decode(mode);
        return this;
    }

    /**
     * Update 'mode' value.
     * @param update - string representation of the changes to apply to access mode.
     */
    updateMode(update: string): AccessMode {
        this.mode = AccessMode.update(this.mode, update);
        return this;
    }

    /**
     * Get 'mode' value as a string.
     */
    getMode(): string {
        return AccessMode.encode(this.mode);
    }

    /**
     * Assign 'given' value.
     * @param given  - either a string representation of the access mode or a set of bits.
     */
    setGiven(given: string | number): AccessMode {
        this.given = AccessMode.decode(given);
        return this;
    }

    /**
     * Update 'given' value.
     * @param update - string representation of the changes to apply to access mode.
     */
    updateGiven(update: string): AccessMode {
        this.given = AccessMode.update(this.given, update);
        return this;
    }

    /**
     * Get 'given' value as a string.
     */
    getGiven(): string {
        return AccessMode.encode(this.given);
    }

    /**
     * Assign 'want' value.
     * @param want - either a string representation of the access mode or a set of bits.
     */
    setWant(want: string | number): AccessMode {
        this.want = AccessMode.decode(want);
        return this;
    }

    /**
     * Update 'want' value.
     * @param update - string representation of the changes to apply to access mode.
     */
    updateWant(update: string): AccessMode {
        this.want = AccessMode.update(this.want, update);
        return this;
    }

    /**
     * Get 'want' value as a string.
     */
    getWant(): string {
        return AccessMode.encode(this.want);
    }

    /**
     * Get permissions present in 'want' but missing in 'given'.
     */
    getMissing(): string {
        return AccessMode.encode(this.want & ~this.given);
    }

    /**
     * Get permissions present in 'given' but missing in 'want'.
     */
    getExcessive(): string {
        return AccessMode.encode(this.given & ~this.want);
    }

    /**
     * Update 'want', 'give', and 'mode' values.
     * @param val - new access mode value.
     */
    updateAll(val: AccessMode): AccessMode {
        if (val) {
            this.updateGiven(val.getGiven());
            this.updateWant(val.getWant());
            this.mode = this.given & this.want;
        }
        return this;
    }

    /**
     * Check if Owner (O) flag is set.
     * @param side - which permission to check: given, want, mode; default: mode.
     */
    isOwner(side: string): boolean {
        return AccessMode.checkFlag(this, side, AccessModeFlags.OWNER);
    }

    /**
     * Check if Presence (P) flag is set.
     * @param side - which permission to check: given, want, mode; default: mode.
     */
    isPresencer(side: string): boolean {
        return AccessMode.checkFlag(this, side, AccessModeFlags.PRES);
    }

    /**
     * Check if Presence (P) flag is NOT set.
     * @param side - which permission to check: given, want, mode; default: mode.
     */
    isMuted(side: string): boolean {
        return !this.isPresencer(side);
    }

    /**
     * Check if Presence (P) flag is NOT set.
     * @param side - which permission to check: given, want, mode; default: mode.
     */
    isJoiner(side: string): boolean {
        return AccessMode.checkFlag(this, side, AccessModeFlags.JOIN);
    }

    /**
     * Check if Reader (R) flag is set.
     * @param side - which permission to check: given, want, mode; default: mode.
     */
    isReader(side: string): boolean {
        return AccessMode.checkFlag(this, side, AccessModeFlags.READ);
    }

    /**
     * Check if Writer (W) flag is set.
     * @param side - which permission to check: given, want, mode; default: mode.
     */
    isWriter(side: string): boolean {
        return AccessMode.checkFlag(this, side, AccessModeFlags.WRITE);
    }

    /**
     * Check if Approver (A) flag is set.
     * @param side - which permission to check: given, want, mode; default: mode.
     */
    isApprover(side: string): boolean {
        return AccessMode.checkFlag(this, side, AccessModeFlags.APPROVE);
    }

    /**
     * Check if either one of Owner (O) or Approver (A) flags is set.
     * @param side - which permission to check: given, want, mode; default: mode.
     */
    isAdmin(side: string): boolean {
        return this.isOwner(side) || this.isApprover(side);
    }

    /**
     * Check if either one of Owner (O), Approver (A), or Sharer (S) flags is set.
     * @param side - which permission to check: given, want, mode; default: mode.
     */
    isSharer(side: string): boolean {
        return this.isAdmin(side) || AccessMode.checkFlag(this, side, AccessModeFlags.SHARE);
    }

    /**
     * Check if Deleter (D) flag is set.
     * @param side - which permission to check: given, want, mode; default: mode.
     */
    isDeleter(side: string): boolean {
        return AccessMode.checkFlag(this, side, AccessModeFlags.DELETE);
    }

    /**
     * Custom formatter
     */
    toString(): string {
        return '{"mode": "' + AccessMode.encode(this.mode) +
            '", "given": "' + AccessMode.encode(this.given) +
            '", "want": "' + AccessMode.encode(this.want) + '"}';
    }

    jsonHelper() {
        return {
            mode: AccessMode.encode(this.mode),
            given: AccessMode.encode(this.given),
            want: AccessMode.encode(this.want)
        };
    }
}
