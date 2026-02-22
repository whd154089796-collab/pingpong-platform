"use client";

import { useEffect } from "react";
import { CSRF_FORM_FIELD } from "@/lib/csrf-constants";

function ensureTokenField(form: HTMLFormElement, token: string) {
  if (!token) return;
  let input = form.querySelector(
    `input[name="${CSRF_FORM_FIELD}"]`,
  ) as HTMLInputElement | null;
  if (!input) {
    input = document.createElement("input");
    input.type = "hidden";
    input.name = CSRF_FORM_FIELD;
    form.prepend(input);
  }
  input.value = token;
  input.defaultValue = token;
}

export default function CsrfFormInjector() {
  useEffect(() => {
    let tokenCache = "";

    const fetchToken = async () => {
      if (tokenCache) return tokenCache;
      const response = await fetch("/api/csrf-token", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) return "";
      const payload = (await response.json()) as { token?: string };
      tokenCache = payload.token ?? "";
      return tokenCache;
    };

    const applyToAllForms = async () => {
      const token = await fetchToken();
      if (!token) return;
      document.querySelectorAll("form").forEach((form) => {
        ensureTokenField(form as HTMLFormElement, token);
      });
    };

    void applyToAllForms();

    const handleSubmit = async (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      if (!tokenCache) {
        event.preventDefault();
        const token = await fetchToken();
        ensureTokenField(form, token);
        form.requestSubmit();
        return;
      }

      const token = await fetchToken();
      ensureTokenField(form, token);
    };

    document.addEventListener("submit", handleSubmit, true);

    return () => {
      document.removeEventListener("submit", handleSubmit, true);
    };
  }, []);

  return null;
}
