export class CheckoutProductsNotFoundError extends Error {
  public readonly missingProductIds: string[];

  constructor(missingProductIds: string[]) {
    super('Some products in your cart no longer exist.');
    this.name = 'CheckoutProductsNotFoundError';
    this.missingProductIds = missingProductIds;
  }
}
