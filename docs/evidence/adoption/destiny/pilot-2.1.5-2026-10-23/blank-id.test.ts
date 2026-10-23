import { expect, it } from 'vitest';
import { sessionIdentity } from './roster';

it('drops blank IDs from the fireteam identity while retaining a real member', () => {
    expect(sessionIdentity({
        activityHash: 123,
        partyMembers: [{ membershipId: '' }, { membershipId: '4611686018400000001' }],
    })).toEqual({ activityHash: 123, memberIds: ['4611686018400000001'] });
});
