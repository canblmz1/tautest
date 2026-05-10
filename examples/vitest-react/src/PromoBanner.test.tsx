import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PromoBanner } from './PromoBanner';

describe('PromoBanner', () => {
  it('shows the reward for members above the cart threshold', () => {
    const html = renderToStaticMarkup(<PromoBanner isMember={true} cartTotal={150} />);

    expect(html).toContain('Member reward unlocked');
  });

  it('does not show the reward for non-members', () => {
    const html = renderToStaticMarkup(<PromoBanner isMember={false} cartTotal={150} />);

    expect(html).toContain('Keep shopping');
  });
});
