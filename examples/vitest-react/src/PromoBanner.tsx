export interface PromoBannerProps {
  isMember: boolean;
  cartTotal: number;
}

export function PromoBanner({ isMember, cartTotal }: PromoBannerProps) {
  const qualifies = isMember && cartTotal >= 100;

  return (
    <section>
      <h1>{qualifies ? 'Member reward unlocked' : 'Keep shopping'}</h1>
      <p>{qualifies ? 'You qualify for free shipping.' : 'Rewards start at $100.'}</p>
    </section>
  );
}
