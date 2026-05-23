import { ChangeDetectionStrategy, Component, computed, signal, type Signal } from '@angular/core';
import {
  FormField,
  email,
  form,
  minLength,
  required,
  submit,
  validate,
  type SchemaFn,
  type ValidationError,
} from '@angular/forms/signals';

import { err, ok, type StructuredResponse } from '../../core/webmcp/structured-response';

import {
  CONTACT_TOPICS,
  EMPTY_CONTACT_FORM,
  type ContactFormModel,
  type ContactTopic,
} from './contact-form.model';

/** Success payload for the `submitContactForm` Form_Tool. */
interface SubmissionSuccess {
  readonly submitted: true;
  readonly ticketId: string;
}

/** Error payload produced by `err(...)`. */
interface SubmissionErrorPayload {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}

let nextTicketId = 1;

/** Generate a demo-only ticket id. */
function generateTicketId(): string {
  const id = nextTicketId++;
  return `TICKET-${id.toString().padStart(4, '0')}`;
}

/**
 * Schema function for the contact form. Exported so property tests can
 * build the same form structure without depending on Angular component
 * instantiation.
 */
export const contactFormSchema: SchemaFn<ContactFormModel> = (path) => {
  required(path.name, { message: 'Name is required.' });
  minLength(path.name, 1, { message: 'Name must not be empty.' });

  required(path.email, { message: 'Email is required.' });
  email(path.email, { message: 'Email must be a valid address.' });

  required(path.topic, { message: 'Topic is required.' });
  validate<ContactTopic>(path.topic, ({ value }) =>
    CONTACT_TOPICS.includes(value())
      ? null
      : ({
          kind: 'topic',
          message: 'Topic must be one of: ' + CONTACT_TOPICS.join(', ') + '.',
        } satisfies ValidationError.WithoutFieldTree),
  );

  required(path.message, { message: 'Message is required.' });
  minLength(path.message, 10, {
    message: 'Message must be at least 10 characters.',
  });
};

/**
 * Build the validation-error Structured_Response surfaced when the
 * form's validators reject submission. Exported so property tests can
 * compare the response shape against the runtime contract.
 */
export function buildValidationErrorResponse(
  fieldErrors: Record<string, readonly string[]>,
): StructuredResponse {
  return err('validation', 'Contact form is invalid; submission was not performed.', {
    fieldErrors,
  });
}

/**
 * Contact page (`/contact`). Hosts the Signal Form that produces the
 * `submitContactForm` Form_Tool via `form()`'s `experimentalWebMcpTool`
 * option. The submit action runs whether the user clicks Submit or
 * invokes the tool through `navigator.modelContext`, so the validation
 * gating and the response shape are identical across both paths.
 */
@Component({
  selector: 'app-contact',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    .contact-grid {
      display: grid;
      gap: var(--space-5);
      grid-template-columns: minmax(0, 1fr) minmax(0, 320px);
    }

    @media (max-width: 720px) {
      .contact-grid {
        grid-template-columns: 1fr;
      }
    }

    .contact-form {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-5);
      background: var(--color-bg-elevated);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
    }

    .contact-form__row {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .contact-form button[type='submit'] {
      align-self: flex-start;
    }

    .side-card {
      padding: var(--space-5);
      background: var(--color-bg-elevated);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      align-self: start;
      position: sticky;
      top: calc(var(--header-height) + var(--space-4));
    }

    .side-card h2 {
      font-size: 1rem;
      margin-bottom: var(--space-2);
    }

    .side-card p {
      font-size: 0.9rem;
    }

    .feedback {
      margin-top: var(--space-4);
      padding: var(--space-4);
      border-radius: var(--radius-md);
    }

    .feedback--success {
      background: var(--color-success-soft);
      color: var(--color-success);
      border: 1px solid color-mix(in srgb, var(--color-success) 30%, transparent);
    }

    .feedback--error {
      background: var(--color-danger-soft);
      color: var(--color-danger);
      border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
    }

    .feedback ul {
      list-style: disc;
      padding-left: 1.4rem;
      margin-top: var(--space-2);
    }

    .feedback ul li {
      margin: var(--space-1) 0;
    }
  `,
  template: `
    <section aria-labelledby="contact-title">
      <h1 id="contact-title">Contact</h1>
      <p>
        This form registers the <code>submitContactForm</code> tool via <code>form()</code>'s
        <code>experimentalWebMcpTool</code> option. The same submit action runs whether you click
        Submit or invoke the tool through <code>navigator.modelContext</code>, so the validation
        gating and the response shape are identical across both paths.
      </p>

      <div class="contact-grid">
        <form class="contact-form" (submit)="onSubmit($event)" novalidate>
          <div class="contact-form__row">
            <label for="contact-name">Name</label>
            <input
              id="contact-name"
              type="text"
              autocomplete="name"
              [formField]="contactForm.name"
            />
          </div>

          <div class="contact-form__row">
            <label for="contact-email">Email</label>
            <input
              id="contact-email"
              type="email"
              autocomplete="email"
              [formField]="contactForm.email"
            />
          </div>

          <div class="contact-form__row">
            <label for="contact-topic">Topic</label>
            <select id="contact-topic" [formField]="contactForm.topic">
              @for (option of topics; track option) {
                <option [value]="option">{{ option }}</option>
              }
            </select>
          </div>

          <div class="contact-form__row">
            <label for="contact-message">Message</label>
            <textarea id="contact-message" rows="5" [formField]="contactForm.message"></textarea>
          </div>

          <button type="submit" [disabled]="submitting()">
            @if (submitting()) {
              Submitting…
            } @else {
              Submit
            }
          </button>

          @if (submission(); as response) {
            @if (successPayload(); as success) {
              <div class="feedback feedback--success" role="status" aria-live="polite">
                <strong>Submission accepted.</strong> Ticket id:
                <code>{{ success.ticketId }}</code>
              </div>
            }

            @if (errorPayload(); as failure) {
              <div class="feedback feedback--error" role="alert">
                <strong>{{ failure.code }}</strong
                >: {{ failure.message }}
                @if (fieldErrorMessages().length > 0) {
                  <ul aria-label="Validation errors">
                    @for (entry of fieldErrorMessages(); track entry.field) {
                      <li><strong>{{ entry.field }}</strong>: {{ entry.message }}</li>
                    }
                  </ul>
                }
              </div>
            }
          }
        </form>

        <aside class="side-card" aria-label="What this form proves">
          <h2>What this proves</h2>
          <p>
            Validators are wired through <code>form()</code>'s schema. They run before submission
            for both manual clicks and tool invocations.
          </p>
          <p>
            On <code>/contact</code>, <code>navigator.modelContext.getTools()</code> includes
            <code>submitContactForm</code>. Navigate away and the tool unregisters automatically.
          </p>
        </aside>
      </div>
    </section>
  `,
})
export class ContactComponent {
  protected readonly topics = CONTACT_TOPICS;

  /** Mutable form model used as `form()`'s source of truth. */
  private readonly model = signal<ContactFormModel>({ ...EMPTY_CONTACT_FORM });

  /**
   * Signal Form built around {@link model}. The `experimentalWebMcpTool`
   * option carries the WebMCP registration; the runtime infers the
   * input schema from {@link ContactFormModel} and runs the same submit
   * action this component's `<form>` element uses.
   */
  protected readonly contactForm = form(this.model, contactFormSchema, {
    experimentalWebMcpTool: {
      name: 'submitContactForm',
      description:
        'Submit the contact form. Validates name, email, topic, and message before submission.',
    },
    submission: {
      action: () => this.runSubmit(),
    },
  });

  /** Submission feedback rendered below the form. */
  protected readonly submission = signal<StructuredResponse | null>(null);

  protected readonly submitting: Signal<boolean> = computed(() => this.contactForm().submitting());

  protected readonly successPayload = computed<SubmissionSuccess | null>(() => {
    const response = this.submission();
    if (response === null || response.status !== 'success') {
      return null;
    }
    return response.payload as SubmissionSuccess;
  });

  protected readonly errorPayload = computed<SubmissionErrorPayload | null>(() => {
    const response = this.submission();
    if (response === null || response.status !== 'error') {
      return null;
    }
    return response.payload as SubmissionErrorPayload;
  });

  /** Flat list of `{ field, message }` rows derived from the error payload. */
  protected readonly fieldErrorMessages = computed<readonly { field: string; message: string }[]>(
    () => {
      const error = this.errorPayload();
      if (!error || typeof error.details !== 'object' || error.details === null) {
        return [];
      }
      const details = error.details as { fieldErrors?: unknown };
      const fieldErrors = details.fieldErrors;
      if (!fieldErrors || typeof fieldErrors !== 'object') {
        return [];
      }
      const rows: { field: string; message: string }[] = [];
      for (const [field, messages] of Object.entries(fieldErrors as Record<string, unknown>)) {
        if (Array.isArray(messages)) {
          for (const message of messages) {
            rows.push({ field, message: String(message) });
          }
        }
      }
      return rows;
    },
  );

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    const successful = await submit(this.contactForm);
    if (!successful) {
      this.submission.set(this.buildValidationError());
    }
  }

  /**
   * Submit-action body shared by the `<form>` and the Form_Tool. The
   * Signal Forms runtime gates on validity before invoking the action,
   * so reaching here means every validator has passed.
   */
  private async runSubmit(): Promise<undefined> {
    const ticketId = generateTicketId();
    this.submission.set(ok<SubmissionSuccess>({ submitted: true, ticketId }));
    return undefined;
  }

  private buildValidationError(): StructuredResponse {
    const root = this.contactForm();
    const fieldErrors: Record<string, string[]> = {};
    for (const { fieldTree, message, kind } of root.errorSummary()) {
      const fieldName = fieldTree().name();
      const text = message ?? kind;
      const list = fieldErrors[fieldName] ?? [];
      list.push(text);
      fieldErrors[fieldName] = list;
    }
    return buildValidationErrorResponse(fieldErrors);
  }
}
