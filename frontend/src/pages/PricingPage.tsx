import { SubscriptionPricingPage } from "@/components/SubscriptionPricingPage";

interface Props {
  role?: 'parent' | 'institute';
  onNavigate?: (screen: string) => void;
}

export function PricingPage({ role = 'parent', onNavigate }: Props) {
  return <SubscriptionPricingPage role={role} onNavigate={onNavigate} />;
}
