/**
 * Data model backing the contact-page Signal Form.
 *
 * Field constraints (enforced by validators in `contact.component.ts`):
 * - `name`: required, minimum length 1.
 * - `email`: required, must be a valid email address.
 * - `topic`: required, constrained to {@link CONTACT_TOPICS}.
 * - `message`: required, minimum length 10.
 *
 * The runtime form-tool schema is inferred from this model by
 * `@angular/forms/signals`, so keeping the field types narrow (string
 * literals instead of `string`) is what gives the WebMCP tool a precise
 * schema for `topic`.
 */
export interface ContactFormModel {
  name: string;
  email: string;
  topic: 'support' | 'sales' | 'feedback';
  message: string;
}

/** Allowed values for the `topic` field. */
export const CONTACT_TOPICS = ['support', 'sales', 'feedback'] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number];

/** Default empty `ContactFormModel` used as the form's initial state. */
export const EMPTY_CONTACT_FORM: ContactFormModel = {
  name: '',
  email: '',
  topic: 'support',
  message: '',
};
