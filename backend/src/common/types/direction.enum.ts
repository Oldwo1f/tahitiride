export enum Direction {
  CITY = 'city',
  COUNTRY = 'country',
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export enum TripStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum WalletTransactionType {
  INITIAL = 'initial',
  DEBIT = 'debit',
  CREDIT = 'credit',
  ADJUSTMENT = 'adjustment',
}

export enum WalletRequestType {
  DEPOSIT = 'deposit',
  PAYOUT = 'payout',
}

export enum WalletRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}
