"use client";

import { useEffect } from "react";
import { CSRF_COOKIE_NAME, CSRF_FORM_FIELD } from "@/lib/csrf-constants";

function readCookie(name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

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
}

export default function CsrfFormInjector() {
  useEffect(() => {
    const applyToAllForms = () => {
      const token = readCookie(CSRF_COOKIE_NAME);
      if (!token) return;
      document.querySelectorAll("form").forEach((form) => {
        ensureTokenField(form as HTMLFormElement, token);
      });
    };

    applyToAllForms();

    const handleSubmit = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const token = readCookie(CSRF_COOKIE_NAME);
      ensureTokenField(form, token);
    };

    document.addEventListener("submit", handleSubmit, true);

    return () => {
      document.removeEventListener("submit", handleSubmit, true);
    };
  }, []);

  return null;
}
