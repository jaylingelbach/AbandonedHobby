import CheckoutView from '@/modules/checkout/ui/views/checkout-view';

// Global checkout not tenant specific
const Page = async () => {
  return <CheckoutView />;
};

export default Page;
