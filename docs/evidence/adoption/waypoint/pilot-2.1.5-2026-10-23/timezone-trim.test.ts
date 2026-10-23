import { expect, it } from 'vitest';
import { tripTz } from './trip-time';

it('preserves a valid stored timezone surrounded by whitespace', () => {
	expect(tripTz({ timezone: '  Europe/Madrid  ' })).toBe('Europe/Madrid');
});
