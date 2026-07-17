# OGC Process Form Validation Feedback Design

## Context

The OGC process execution form already maps dotted Laravel validation errors to
rendered controls and scrolls to the first server-side error. Browser constraint
validation still uses the browser's default popup, reports one field at a time,
and does not expose a persistent corrected state after the user fixes a field.

This follow-up replaces the browser popup with accessible inline feedback while
retaining the browser Constraint Validation API as the client-side source of
truth. It extends the form introduced by the 2026-07-17 OGC process UI
validation work and remains scoped to the process execution form.

## Goals

- Show every browser-detectable field error after the user presses `Execute`.
- Give every invalid control a destructive border and focus ring.
- Show an icon-bearing destructive message box directly below the related
  control.
- Scroll the first invalid rendered control to the vertical center of the
  viewport and focus it.
- Turn a previously invalid field green, including a success icon and green
  border/focus ring, as soon as a subsequent user edit satisfies its client-side
  constraints.
- Keep fields neutral until they have first been invalid.
- Continue displaying dotted server validation errors on the correct controls.
- Preserve legibility and contrast in light and dark themes.

## Non-Goals

- Do not introduce React Hook Form, Zod, or another form-state dependency.
- Do not duplicate server-only OGC schema validation in the browser.
- Do not change backend validation rules, payload normalization, or process
  submission semantics.
- Do not redesign validation feedback in unrelated application forms.
- Do not show a success message for every valid field or for untouched fields.

## Chosen Architecture

Inertia `useForm` remains the owner of submitted values, processing state, and
server errors. A focused OGC validation layer owns only client constraint errors
and the visual lifecycle of fields that have failed validation.

The form is rendered with `noValidate` to suppress browser validation bubbles.
The submit handler explicitly evaluates the active native controls through
`checkValidity()` and reads each failing control's localized
`validationMessage`. This retains standard browser constraint behavior for
`required`, `type`, `min`, `max`, `step`, `maxLength`, and compatible `pattern`
attributes while allowing the application to render all messages together.

React Hook Form is not adopted because its form state would overlap with the
existing Inertia form, require controllers for the dynamic Radix and OGC
components, and still require custom translation of dotted Laravel errors and
centered scrolling. Its field arrays and revalidation modes do not remove the
server-only validation boundary.

## Validation State Model

Each rendered path has one of these visual states:

- `neutral`: the field has not failed validation, or a server-only error was
  edited but cannot yet be confirmed locally;
- `invalid`: the field currently has a client or server error;
- `corrected`: the field previously had a client-detectable error and a later
  user edit made its native control valid.

Client error records retain their source, path, and message. Server errors stay
in the Inertia error map. Rendering derives a combined error map in which the
current server message wins when both sources contain the same path.

The corrected set is independent from the current error maps so that only an
`invalid -> corrected` transition can produce green feedback. A field that was
always valid never enters the corrected set.

Paths belonging to controls that unmount because a `oneOf` variant, complex
input mode, or dynamic row changed are removed from client errors, corrected
state, and stale exact-path Inertia errors. Hidden, disabled, or disconnected
controls do not participate in submit validation or visual ordering.

## Submit Flow

When the user presses `Execute`:

1. Prevent the default submit.
2. Query active controls carrying `data-field-path` in DOM order.
3. For native input, textarea, and select controls, run `checkValidity()` and
   collect every non-empty `validationMessage` under its field path. If more
   than one active control exposes the same path, keep the first message in DOM
   order.
4. Replace the current client error map with the collected result and mark all
   failing paths invalid.
5. Remove newly failing paths from the corrected set.
6. If any client error exists, abort the Inertia request and schedule focus and
   centered scrolling after React renders the feedback.
7. If no client error exists, run the existing input normalization and Inertia
   submission flow.
8. If Laravel returns validation errors, mark all returned paths invalid and
   invoke the same focus-and-scroll behavior after rendering.

Multiple DOM controls may expose the same path, such as a complex reference
selector and URL input. The active native control supplies the message, while
the first rendered focusable target for that path remains the navigation target.

## Revalidation After Editing

Native controls use delegated input/change handling from the form. Every user
edit first clears the stale exact-path Inertia error, if present. Revalidation
otherwise does no work for a path that has never been invalid.

For a path with a client-detectable error:

- if `checkValidity()` still fails, keep it invalid and refresh the message from
  `validationMessage`;
- if it passes, remove its client error and mark it corrected immediately.

For a path whose current error came only from the server:

- return the field to neutral rather than claiming success;
- allow the next submission response to confirm or reject it.

When client and server errors previously shared a path, clearing the stale
server message exposes the client revalidation result: a still-invalid control
stays red, while a locally valid control can make the `invalid -> corrected`
transition.

Custom Radix controls call the same exact-path change callback because their
value changes are not guaranteed to emit a native event from the element tagged
with `data-field-path`. Editing one field must not clear sibling or descendant
errors.

Programmatic example-payload prefilling re-evaluates only paths already marked
invalid. It does not paint untouched fields green.

## Shadcn And Visual Treatment

The implementation follows the installed shadcn/ui field conventions:

- `data-invalid` is set on `Field`;
- `aria-invalid="true"` is set on the actual control;
- `aria-describedby` connects the control to its feedback;
- `FieldError` provides the accessible error container.

The local shadcn input, textarea, and select primitives already provide the
destructive border and focus-ring foundation for `aria-invalid`. OGC-specific
feedback adds the persistent destructive presentation required by this form
without changing unrelated forms.

The existing global destructive summary remains visible whenever the combined
client/server error map is non-empty, but it never replaces field-level
feedback.

The inline error is a compact box below the control with:

- a `CircleAlert` icon;
- destructive text and border;
- a translucent destructive background;
- padding and rounded corners consistent with the installed shadcn components;
- explicit dark-theme border, background, and foreground values.

Corrected controls receive `data-validation-state="valid"`, an emerald border,
an emerald focus ring, and a `CircleCheck` icon aligned at the right side of the
control. The icon is decorative visually and accompanied by screen-reader-only
text indicating that the field is valid. No green explanatory box is rendered.

Error styling always takes precedence if a path appears in both invalid and
corrected state during an asynchronous update.

## Focus And Scrolling

The existing first-invalid-path resolution remains based on rendered DOM order,
preferring an exact child control over a structural parent fallback.

After errors render, the selected target receives:

```ts
target.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
});
target.focus({ preventScroll: true });
```

`requestAnimationFrame` defers navigation until the inline box and any resulting
layout change are present. `preventScroll` avoids the focus call overriding the
centered position. Structural errors continue to target the focusable section
container when no leaf control exists.

## Accessibility

- Invalid controls expose `aria-invalid="true"`.
- Each error box has a stable path-derived ID, `role="alert"`, and is referenced
  by `aria-describedby`.
- Corrected fields do not misuse an ARIA validity attribute; they use the data
  attribute for styling and screen-reader-only status text.
- Icons do not replace the message or color cue.
- Destructive and emerald colors include light and dark variants with visible
  borders and focus rings.
- Focus remains on the first invalid interactive control after centered scroll.

## Error Precedence And Lifecycle

- A current server message wins over a client message for the same path.
- A current error always wins over corrected styling.
- A subsequent failed submit replaces stale client messages with the latest
  browser messages for all active controls.
- A successful local correction removes only the exact client error.
- Every edit clears only its exact stale server presentation. A server-only path
  returns to neutral; a path with a client error uses the fresh native validity
  result.
- A successful Inertia navigation naturally discards the local validation
  lifecycle with the form component.

## Testing Strategy

Frontend tests will extend `tests/Frontend/ogc-form-errors.test.ts` and add a
focused validation-state test module if separation keeps each file concise.
Tests must exercise real pure helpers rather than duplicating their algorithm in
assertions.

Coverage includes:

- collecting every invalid active native control in DOM order;
- ignoring hidden, disabled, disconnected, and non-native structural targets;
- preserving localized browser `validationMessage` values;
- server-over-client message precedence for the same path;
- neutral, invalid, and corrected state transitions;
- refusing to mark untouched or server-only edited fields corrected;
- clearing only the exact edited server path;
- removing state for unmounted dynamic paths;
- selecting the first exact invalid child before structural fallbacks;
- invoking smooth centered scrolling and focus with `preventScroll`;
- wiring `noValidate`, Shadcn accessibility attributes, error boxes, success
  icons, and dark-theme classes through every OGC field kind.

The focused Bun tests, TypeScript check, ESLint check, Prettier check, and
production build must pass. A real-browser verification will submit a process
form with multiple invalid fields, confirm simultaneous red feedback and centered
scrolling, correct the first field, confirm the green transition, and verify the
same flow in dark mode.

## Acceptance Criteria

- Pressing `Execute` with multiple browser-invalid controls shows every inline
  error without a native browser popup.
- Every invalid control has a red border/focus ring and a red icon-bearing box.
- The first invalid control is vertically centered and focused.
- Correcting a previously client-invalid field immediately gives it a green
  border/focus ring and check icon.
- Untouched valid fields remain neutral.
- Editing a server-only error returns it to neutral until the next server
  response.
- Server errors continue to map to nested dotted paths and use the same red
  feedback and navigation.
- Dynamic variants and rows do not retain stale validation state after unmount.
- Light and dark themes both retain readable feedback and visible focus states.
- No new frontend dependency is introduced.
