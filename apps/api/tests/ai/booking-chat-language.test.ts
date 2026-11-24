import assert from "node:assert/strict";
import { test } from "node:test";
import { config } from "../../src/env.js";
import { MockLanguageModelV4, MockProviderV4 } from "ai/test";
import {
  bookingLanguageSamples,
  localizeBookingReview,
} from "../../src/services/ai/localize-booking-chat.js";
import {
  bookingRequestReceipt,
  bookingReviewBody,
  bookingReviewPresets,
} from "../../src/services/booking-requests/booking-chat-messages.js";

const history = [
  { sender_role: "customer", body: "Quiero organizar una fiesta." },
  { sender_role: "assistant", body: "What is your phone number?" },
  { sender_role: "customer", body: "+63 912 345 6789" },
];

test("a booking review keeps customer language and renders verified details", async (t) => {
  const oldProvider = globalThis.AI_SDK_DEFAULT_PROVIDER;
  const oldModel = config.TEXT_MODEL;
  const oldKey = config.AI_GATEWAY_API_KEY;
  const modelId = "fixture/translation";
  config.TEXT_MODEL = modelId;
  config.AI_GATEWAY_API_KEY = "fixture-key";
  t.after(() => {
    globalThis.AI_SDK_DEFAULT_PROVIDER = oldProvider;

    config.TEXT_MODEL = oldModel;

    config.AI_GATEWAY_API_KEY = oldKey;
  });

  const spanishCopy = {
    introduction: "Revisa los datos de tu solicitud.",
    event: "Evento",
    duration: "Duración",
    oneDay: "Un día",
    multipleDays: "Varios días",
    dates: "Fechas solicitadas",
    timeZone: "Zona horaria del evento",
    contact: "Persona de contacto",
    phone: "Teléfono",
    guestCount: "Número de invitados",
    location: "Lugar preferido",
    package: "Paquete",
    packageCapacity: "hasta [[capacity]] invitados",
    noPackage: "Sin paquete seleccionado",
    budget: "Presupuesto",
    specialRequests: "Peticiones especiales",
    services: "Servicios solicitados",
    oneHour: "[[hours]] hora",
    multipleHours: "[[hours]] horas",
    included: "Incluido en el paquete",
    capacityWarning:
      "El número de invitados supera la capacidad de [[capacity]]. AMAC revisará el caso.",
    signIn: "Inicia sesión para revisar la solicitud antes de enviarla.",
    confirmation: "¿Quieres que envíe la solicitud a AMAC para que la revise?",
    corrections: "Dime si quieres cambiar algún detalle.",
  };
  let translations = 0;

  const model = new MockLanguageModelV4({
    doGenerate: async ({ abortSignal }) => {
      const attempt = ++translations;

      if (attempt === 7) throw new Error("provider unavailable");

      if (attempt === 8) {
        await new Promise<void>((_, reject) => {
          abortSignal?.addEventListener(
            "abort",
            () => reject(abortSignal.reason),
            { once: true },
          );
        });
      }

      const output =
        attempt >= 3 && attempt <= 5
          ? {
              style: (["taglish", "fil", "en"] as const)[attempt - 3],
              copy: null,
            }
          : attempt === 6
            ? { style: "other", copy: null }
            : {
                style: "other",
                copy: {
                  ...spanishCopy,
                  confirmation:
                    attempt === 1
                      ? spanishCopy.confirmation
                      : "¿Lo envío? ¿Está todo bien?",
                },
              };

      return {
        content: [{ type: "text", text: JSON.stringify(output) }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: {
            total: 1,
            noCache: 1,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 1, text: 1, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });

  globalThis.AI_SDK_DEFAULT_PROVIDER = new MockProviderV4({
    languageModels: { [modelId]: model },
  });

  assert.deepEqual(bookingLanguageSamples(history), [history[0].body]);
  const signal = AbortSignal.timeout(1000);
  const copy = await localizeBookingReview(history, signal);
  assert.deepEqual(copy.copy, spanishCopy);
  assert.ok(copy.suggestedReplies.length);
  await assert.rejects(localizeBookingReview(history, signal));

  const taglishCopy = await localizeBookingReview(
    [
      { sender_role: "customer", body: "Mag-book sana ako ng birthday party." },
      history[2],
    ],
    signal,
  );
  assert.equal(
    taglishCopy.copy.confirmation,
    "I-send ko na sa AMAC team para ma-review?",
  );
  assert.equal(
    taglishCopy.copy.corrections,
    "Sabihin mo lang kung may papalitan.",
  );
  assert.deepEqual(
    (await localizeBookingReview(history, signal)).copy,
    bookingReviewPresets.fil,
  );
  assert.deepEqual(
    (await localizeBookingReview(history, signal)).copy,
    bookingReviewPresets.en,
  );
  await assert.rejects(localizeBookingReview(history, signal));
  assert.deepEqual(
    (await localizeBookingReview([history[2]], signal)).copy,
    bookingReviewPresets.en,
  );
  await assert.rejects(localizeBookingReview(history, signal));
  const deadline = AbortSignal.timeout(25);
  await assert.rejects(localizeBookingReview(history, deadline));

  const body = bookingReviewBody(
    {
      eventType: "Birthday *with karaoke*",
      durationMode: "one_day",
      requestedDates: ["2030-07-22"],
      timeZone: "Asia/Manila",
      contactName: "Rosa Rivera",
      phoneNumber: "09123456789",
      guestCount: 120,
      budget: "₱100,000 for everything",
    },
    {
      selectedPackage: {
        id: "package",
        name: "Garden Party",
        price: 70_000,
        maxGuests: 100,
        revision: "revision",
      },
      requestedServices: [
        {
          serviceId: null,
          name: "bilingual host",
          hours: 2,
          notes: "Spanish and Cebuano",
          included: false,
          updatedAt: null,
        },
      ],
      outOfRange: true,
    },
    false,
    copy.copy,
  );
  assert.match(body, /\*\*Teléfono\*\* · 09123456789/u);
  assert.match(body, /Birthday \\\*with karaoke\\\*/u);
  assert.match(body, /2030\\-07\\-22/u);
  assert.match(body, /Garden Party · ₱70,000 · hasta 100 invitados/u);
  assert.match(body, /bilingual host · 2 horas · Spanish and Cebuano/u);
  assert.match(body, /supera la capacidad de 100/u);
  assert.match(body, /₱100,000 for everything/u);
  assert.match(
    body,
    /¿Quieres que envíe la solicitud a AMAC para que la revise\?/u,
  );
  assert.equal(body.match(/\?/gu)?.length, 1);
});

test("a localized receipt contains the server reference", () => {
  for (const style of ["en", "taglish", "fil"] as const) {
    const receipt = bookingRequestReceipt("BR-ABC", { style });
    assert.match(receipt, /AMAC/u);
    assert.match(receipt, /package/u);
    assert.match(receipt, /chat/u);
    assert.match(receipt, /add\\-on/u);
  }

  assert.match(
    bookingRequestReceipt("BR-ABC", { style: "taglish" }),
    /AMAC team ang booking request BR-ABC para ma\\-review/u,
  );
  assert.match(
    bookingRequestReceipt("BR-ABC", {
      receipt: "Tu solicitud [[reference]] se envió a AMAC para su revisión.",
    }),
    /solicitud BR-ABC se envió a AMAC/u,
  );
  assert.match(
    bookingRequestReceipt("BR-ABC", {
      style: "other",
      receipt: "Tu solicitud [[reference]] se envió a AMAC para su revisión.",
      changesGuidance:
        "Para cambiar el paquete o los extras, escribe al equipo AMAC aquí en este chat.",
    }),
    /Para cambiar el paquete o los extras, escribe al equipo AMAC aquí en este chat/u,
  );
  assert.match(
    bookingRequestReceipt("BR-ABC", {
      style: "other",
      receipt: "Tu solicitud [[reference]] se envió a AMAC para su revisión.",
    }),
    /message AMAC staff here in this chat/u,
  );
  assert.match(
    bookingRequestReceipt("BR-ABC", {
      style: "other",
      receipt: "Tu solicitud [[reference]] se envió a AMAC para su revisión.",
      changesGuidance: "¿Cambiar el paquete?",
    }),
    /message AMAC staff here in this chat/u,
  );
  assert.throws(() =>
    bookingRequestReceipt("BR-ABC", {
      receipt: "Tu solicitud BR-XYZ se envió a AMAC para su revisión.",
    }),
  );
  assert.throws(() => bookingRequestReceipt("BR-ABC", { style: "other" }));
});
