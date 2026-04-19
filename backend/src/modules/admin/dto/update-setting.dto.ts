import { IsDefined } from 'class-validator';

export class UpdateSettingDto {
  /**
   * The new value for the setting. The whitelist of accepted keys plus
   * per-key validation (type, min, max) lives in `SettingsService.EDITABLE`
   * and is enforced inside `AdminSettingsService.update`.
   */
  @IsDefined()
  value!: unknown;
}
