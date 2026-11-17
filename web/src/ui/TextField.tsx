import { forwardRef, type InputHTMLAttributes } from "react";

/// A plain text field for a Form row.
///
/// Safari offers "AutoFill Contact" above the keyboard whenever a field looks
/// like part of an address form, and `autocomplete="off"` alone doesn't stop
/// it: it also scans the placeholder for words like "name" or "title". So
/// those words get an invisible zero-width space in the middle, which reads
/// the same but no longer matches.
const contactWords = /(n)(ame)|(t)(itle)/gi;

function hideFromAutofill(text: string | undefined) {
  return text?.replace(contactWords, (_, n, ame, t, itle) =>
    n ? `${n}​${ame}` : `${t}​${itle}`,
  );
}

export const TextField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextField({ placeholder, className = "", ...props }, ref) {
    return (
      <input
        ref={ref}
        type="text"
        className={`field ${className}`}
        dir="auto"
        autoComplete="off"
        placeholder={hideFromAutofill(placeholder)}
        {...props}
      />
    );
  },
);
