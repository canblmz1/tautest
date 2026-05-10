import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PromoBanner } from '../src/PromoBanner';

describe('PromoBanner fixed boundary coverage', () => {
  it('shows the reward at the exact member cart threshold', () => {
    const html = renderToStaticMarkup(<PromoBanner isMember={true} cartTotal={100} />);

    expect(html).toContain('Member reward unlocked');
  });
});
