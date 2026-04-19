import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Vehicle } from './vehicle.entity';

export enum CertificationType {
  LICENSE = 'license',
  INSURANCE = 'insurance',
}

export enum CertificationStatus {
  PENDING_OCR = 'pending_ocr',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

/**
 * Structured payload returned by the OCR provider after extraction. Stored
 * verbatim in `ocr_extracted` so admins can audit what the model saw and
 * why a document was auto-approved or pushed to the review queue.
 */
export interface OcrExtractionResult {
  /** Detected full name on a driver license. */
  name?: string | null;
  /** Detected expiry date in ISO format (YYYY-MM-DD). */
  expires_at?: string | null;
  /** Detected plate on an insurance vignette (uppercase, no spaces). */
  plate?: string | null;
  /** 0..1 self-reported confidence by the model. */
  confidence?: number | null;
  /** Raw model response (for debugging). */
  raw?: unknown;
  /** Optional human-readable reason filled when auto-decisioning. */
  decision_notes?: string | null;
}

/**
 * One row per submitted document. License rows have `vehicle_id = null`
 * (they belong to the user); insurance rows always carry a `vehicle_id`.
 * The `chk_certifications_vehicle_for_insurance` DB constraint enforces
 * this invariant.
 */
@Entity('certifications')
@Index(['user_id', 'type', 'status'])
@Index(['vehicle_id', 'type'])
@Index(['status', 'expires_at'])
export class Certification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @ManyToOne(() => User, (u) => u.certifications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'uuid', nullable: true })
  vehicle_id!: string | null;

  @ManyToOne(() => Vehicle, (v) => v.certifications, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle?: Vehicle | null;

  @Column({ type: 'enum', enum: CertificationType })
  type!: CertificationType;

  @Column({ type: 'varchar', length: 255 })
  file_path!: string;

  @Column({
    type: 'enum',
    enum: CertificationStatus,
    default: CertificationStatus.PENDING_OCR,
  })
  status!: CertificationStatus;

  @Column({ type: 'jsonb', nullable: true })
  ocr_extracted!: OcrExtractionResult | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  rejection_reason!: string | null;

  @Column({ type: 'date', nullable: true })
  expires_at!: string | null;

  @CreateDateColumn()
  created_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  reviewed_by_user_id!: string | null;
}
