export type InteractionStatus = 'PENDING' | 'STREAMING' | 'COMPLETED' | 'ERROR' | 'CANCELLED';
export type Metadata = Record<string, any>;

// Base for DB items
export interface DbBase {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}
