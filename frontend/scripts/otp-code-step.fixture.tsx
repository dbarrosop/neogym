// Run in a subprocess so DOM globals stay isolated from other tests.
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { act } from "react";

const dom = new Window({ url: "http://localhost", width: 390, height: 844 });
const window = dom as unknown as typeof globalThis.window;
Object.assign(globalThis, {
  window,
  document: window.document,
  navigator: window.navigator,
  HTMLElement: window.HTMLElement,
  HTMLInputElement: window.HTMLInputElement,
  Node: window.Node,
  NodeFilter: window.NodeFilter,
  Element: window.Element,
  DocumentFragment: window.DocumentFragment,
  MutationObserver: window.MutationObserver,
  ResizeObserver: window.ResizeObserver,
  Event: window.Event,
  CustomEvent: window.CustomEvent,
  getComputedStyle: window.getComputedStyle.bind(window),
  IS_REACT_ACT_ENVIRONMENT: true,
});
if (typeof window.document.elementFromPoint !== "function") {
  Object.assign(window.document, { elementFromPoint: () => null });
}

const { createRoot } = await import("react-dom/client");
const { OtpCodeStep } = await import("@/components/otp-code-step");

interface Deferred {
  resolve: (value: boolean) => void;
}

const SENDING_CODE = /Sending code/;

const verifyCalls: string[] = [];
const pendingVerifies: Deferred[] = [];
let resendCalls = 0;
const pendingResends: Deferred[] = [];
let changeEmailCalls = 0;

function onVerify(code: string) {
  verifyCalls.push(code);
  return new Promise<boolean>((resolve) => pendingVerifies.push({ resolve }));
}
function onResend() {
  resendCalls += 1;
  return new Promise<boolean>((resolve) => pendingResends.push({ resolve }));
}

const container = document.createElement("div");
document.body.append(container);
const root = createRoot(container);

async function settle(action: () => unknown = () => undefined, waitMs = 10) {
  await act(async () => {
    await action();
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  });
}
function codeInput() {
  const input = container.querySelector<HTMLInputElement>("input[data-input-otp]");
  assert(input, "The code input renders");
  return input;
}
function typeCode(value: string) {
  const input = codeInput();
  const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setValue?.call(input, value);
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
}
function button(name: string | RegExp) {
  return [...container.querySelectorAll("button")].find((candidate) => {
    const label = candidate.getAttribute("aria-label") ?? candidate.textContent ?? "";
    return typeof name === "string" ? label === name : name.test(label);
  });
}
function verifyButton() {
  const verify = container.querySelector<HTMLButtonElement>('button[type="submit"]');
  assert(verify, "Verify renders");
  return verify;
}
function resendLine() {
  return container.querySelector("fieldset p")?.textContent ?? "";
}

try {
  await settle(() =>
    root.render(
      <OtpCodeStep
        email="alex@example.com"
        onChangeEmail={() => {
          changeEmailCalls += 1;
        }}
        onVerify={onVerify}
        onResend={onResend}
        resendCooldownSeconds={1}
      />,
    ),
  );

  const legend = container.querySelector("fieldset > legend");
  assert.equal(
    legend?.textContent,
    "Verification code",
    "The code boxes sit in a labelled fieldset",
  );
  assert.equal(codeInput().getAttribute("aria-labelledby"), legend?.id);
  assert.equal(codeInput().getAttribute("autocomplete"), "one-time-code");
  assert.equal(container.querySelectorAll("[data-input-otp-container] > div > div").length, 6);
  assert.match(
    container.textContent ?? "",
    /alex@example\.com/,
    "The email chip shows the address",
  );
  assert.equal(resendLine(), "Didn’t get it? Resend in 0:01");
  assert.equal(verifyButton().textContent, "Verify");
  assert.equal(verifyButton().disabled, true, "Verify waits for six digits");

  await settle(() => typeCode("123"));
  assert.equal(verifyButton().disabled, true);
  assert.deepEqual(verifyCalls, []);

  await settle(() => typeCode("123456"));
  assert.deepEqual(verifyCalls, ["123456"], "A complete code submits on its own");
  assert.equal(verifyButton().disabled, true, "Verify is busy while the code is checked");
  assert.equal(verifyButton().textContent, "Verifying");
  await settle(() => {
    const form = container.querySelector("form");
    form?.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  });
  assert.deepEqual(verifyCalls, ["123456"], "A code in flight is never sent twice");
  assert.equal(button("Change email")?.disabled, true, "Change waits for the check");

  await settle(() => pendingVerifies.shift()?.resolve(false));
  assert.equal(codeInput().value, "", "A rejected code clears the boxes");
  assert.equal(verifyButton().disabled, true);
  assert.equal(verifyButton().textContent, "Verify");

  await settle(() => typeCode("654321"));
  assert.deepEqual(verifyCalls, ["123456", "654321"]);
  await settle(() => pendingVerifies.shift()?.resolve(false));

  await settle(() => typeCode("111222"));
  await settle(() => pendingVerifies.shift()?.resolve(false));
  assert.equal(verifyCalls.length, 3);

  // The cooldown is one second here; the real default is a minute.
  await settle(() => undefined, 1_100);
  const resend = button("Resend code");
  assert(resend, `Resend appears after the cooldown (line: ${resendLine()})`);
  assert.equal(resendLine(), "Didn’t get it? Resend code");
  await settle(() => resend.click());
  assert.equal(resendCalls, 1);
  assert.equal(button(SENDING_CODE)?.disabled, true, "Resend is busy while the code is requested");
  await settle(() => button(SENDING_CODE)?.click());
  assert.equal(resendCalls, 1, "A resend in flight is not repeated");

  await settle(() => pendingResends.shift()?.resolve(false));
  assert(button("Resend code"), "A failed resend leaves the link available");
  await settle(() => button("Resend code")?.click());
  assert.equal(resendCalls, 2);
  await settle(() => pendingResends.shift()?.resolve(true));
  assert.equal(resendLine(), "Didn’t get it? Resend in 0:01", "A sent code restarts the cooldown");
  assert.equal(document.activeElement, codeInput(), "Focus returns to the code after a resend");

  await settle(() => button("Change email")?.click());
  assert.equal(changeEmailCalls, 1, "Change returns to the email step");

  await settle(() => typeCode("999999"));
  assert.equal(verifyCalls.at(-1), "999999");
  await settle(() => pendingVerifies.shift()?.resolve(true));
  assert.equal(verifyButton().textContent, "Verifying", "A signed-in code keeps the step busy");
  assert.equal(verifyButton().disabled, true);
} finally {
  act(() => root.unmount());
  await dom.happyDOM.close();
}
console.info(
  "The code step verifies once per code, clears rejected codes and resends after a cooldown.",
);
