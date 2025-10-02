export class FullyRefundedError extends Error {
  constructor(public orderId: string) {
    super('Order is already fully refunded');
    this.name = 'FullyRefundedError';
    Object.setPrototypeOf(this, FullyRefundedError.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class ExceedsRefundableError extends Error {
  constructor(
    public orderId: string,
    public requestedCents: number,
    public remainingCents: number
  ) {
    super('Requested refund exceeds remaining refundable amount');
    this.name = 'ExceedsRefundableError';
    Object.setPrototypeOf(this, ExceedsRefundableError.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
