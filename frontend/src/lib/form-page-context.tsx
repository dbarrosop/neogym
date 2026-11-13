import { createContext, type ReactNode, useContext } from "react";

/** Where a full-page form renders its actions; see `components/patterns/form-page.tsx`. */
export interface FormPageSlots {
  /** Id the page's `<form>` carries so header and footer submit buttons can target it. */
  formId: string;
  header: HTMLElement | null;
  footer: HTMLElement | null;
}

const FormPageContext = createContext<FormPageSlots | null>(null);

export const FormPageSlotsProvider = FormPageContext.Provider;

export function useFormPageSlots(): FormPageSlots | null {
  return useContext(FormPageContext);
}

/** The `id` a form needs so the form page's submit buttons submit it. */
export function useFormPageFormId(): string | undefined {
  return useContext(FormPageContext)?.formId;
}

/** Forms inside dialogs keep inline actions even when the dialog opens on a form page. */
export function FormPageBoundary({ children }: { children: ReactNode }) {
  return <FormPageContext.Provider value={null}>{children}</FormPageContext.Provider>;
}
