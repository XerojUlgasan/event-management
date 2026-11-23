import {
  MAX_SUGGESTED_REPLIES,
  suggestedReplySchema,
} from "@event-management/contracts/messages";

const copy = {
  en: {
    duration: ["One day", "Multiple days"],
    details: ["I'm not sure yet.", "Can you clarify what you need?"],
    followup: ["What can I do next?"],
    review: ["I need to correct a detail.", "Can you clarify the next step?"],
    receipt: ["How can I update my request?"],
    handoff: ["What information can I share with the team?"],
    acknowledgement:
      "I've passed this conversation to the AMAC team for review. You can continue messaging here while waiting for their reply.",
  },
  taglish: {
    duration: ["One day lang", "Multiple days"],
    details: ["Hindi pa ako sure.", "Ano po yung kailangan na details?"],
    followup: ["Ano po yung next step?"],
    review: ["May detail akong gustong ayusin.", "Ano po yung next step?"],
    receipt: ["Paano ko po maa-update yung request?"],
    handoff: ["Anong details ang puwede kong ibigay sa team?"],
    acknowledgement:
      "Naipasa ko na sa AMAC team ang chat na ito para ma-review. Puwede ka pa ring mag-message dito habang naghihintay ng reply.",
  },
  fil: {
    duration: ["Isang araw", "Higit sa isang araw"],
    details: [
      "Hindi pa ako sigurado.",
      "Puwede bang linawin kung ano ang kailangan?",
    ],
    followup: ["Ano ang susunod na hakbang?"],
    review: ["May detalye akong gustong itama.", "Ano ang susunod na hakbang?"],
    receipt: ["Paano ko mababago ang request ko?"],
    handoff: ["Anong impormasyon ang puwede kong ibigay sa pangkat?"],
    acknowledgement:
      "Naipasa ko na ang usapang ito sa pangkat ng AMAC para matingnan nila. Puwede ka pang magpadala ng mensahe rito habang naghihintay ng sagot.",
  },
  es: {
    duration: ["Un solo día", "Varios días"],
    details: [
      "Todavía no lo sé.",
      "¿Puedes aclarar qué información necesitas?",
    ],
    followup: ["¿Cuál es el siguiente paso?"],
    review: ["Necesito corregir un detalle.", "¿Cuál es el siguiente paso?"],
    receipt: ["¿Cómo puedo actualizar mi solicitud?"],
    handoff: ["¿Qué información puedo compartir con el equipo?"],
    acknowledgement:
      "He pasado esta conversación al equipo de AMAC para que la revise. Puedes seguir escribiendo aquí mientras esperas su respuesta.",
  },
};

type CopyLanguage = keyof typeof copy;

export function suggestedReplyCopy(language: CopyLanguage = "en") {
  return copy[language];
}

// Used when the localization call is unavailable. Keep short, ambiguous
// customer answers from overriding a recognizable conversation language.
export function fallbackReplyLanguage(
  samples: readonly string[],
): CopyLanguage {
  for (const sample of [...samples].reverse()) {
    if (
      /[¿¡]|\b(?:quiero|quisiera|puedes|puedo|días|cuántos|gracias|necesito)\b/iu.test(
        sample,
      )
    )
      return "es";

    if (
      /\b(?:ako|gusto|ilang|araw|hindi|puwede|pwede|lang|mga|kayo|naman|ba)\b/iu.test(
        sample,
      )
    )
      return /\b(?:book|booking|event|package|sure|days?|next|team|help|request)\b/iu.test(
        sample,
      )
        ? "taglish"
        : "fil";
  }

  return "en";
}

export function containsRawToolProtocol(value: string) {
  return /(?:DSML|<\|(?:tool_call|tool_calls|function_call)|<tool_call>)/iu.test(
    value,
  );
}

export function usableSuggestedReplies(values: unknown) {
  if (!Array.isArray(values)) return [];

  const replies = new Map<string, string>();

  for (const value of values) {
    const result = suggestedReplySchema.safeParse(value);

    if (!result.success || containsRawToolProtocol(result.data)) continue;

    const key = result.data.toLowerCase();

    if (!replies.has(key)) replies.set(key, result.data);

    if (replies.size === MAX_SUGGESTED_REPLIES) break;
  }

  return [...replies.values()];
}
