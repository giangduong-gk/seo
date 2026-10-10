import type { ProjectProfile } from "./prompts";
import { EntityProfile } from "./schemas";

export function toProfile(p: { name: string; domain: string | null; industry: string | null; locale: string; brandVoice: string | null; entityProfile: string | null }): ProjectProfile {
  let entity: EntityProfile | null = null;
  if (p.entityProfile) {
    try {
      const r = EntityProfile.safeParse(JSON.parse(p.entityProfile));
      entity = r.success ? r.data : null;
    } catch { entity = null; }
  }
  return { name: p.name, domain: p.domain, industry: p.industry, locale: p.locale, brandVoice: p.brandVoice, entityProfile: entity };
}
