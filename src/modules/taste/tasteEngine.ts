import { aiWithFallback } from '../../shared/elevationHelpers';
import { tasteProfileService } from './TasteProfileService';
import { styleDNAExtractor } from './StyleDNAExtractor';
import { preferenceMemory } from './PreferenceMemory';
import { referenceLibrary } from './ReferenceLibrary';

export class TasteEngine {
  async applyProfile(profileId: string, text: string): Promise<{ adjusted: string; profileName: string }> {
    const profile = await tasteProfileService.get(profileId);
    if (!profile) throw new Error(`Taste profile not found: ${profileId}`);

    const prompt = `Rewrite this text to match taste profile "${profile.name}": warmth ${profile.controls.warmth}, wit ${profile.controls.wit}, lyricism ${profile.controls.lyricism}, pace ${profile.controls.pace}. Return only the rewritten text.`;
    const { text: adjusted } = await aiWithFallback(prompt, text, text, undefined);
    await preferenceMemory.record({ profileId, action: 'apply', snippet: text.slice(0, 200) });
    return { adjusted, profileName: profile.name };
  }

  async compareOutput(profileId: string, textA: string, textB: string) {
    const profile = await tasteProfileService.get(profileId);
    if (!profile) throw new Error(`Taste profile not found: ${profileId}`);

    const dnaA = await styleDNAExtractor.extract(textA);
    const dnaB = await styleDNAExtractor.extract(textB);
    const fitA = styleDNAExtractor.distance(dnaA, profile.controls);
    const fitB = styleDNAExtractor.distance(dnaB, profile.controls);

    await preferenceMemory.record({ profileId, action: 'compare', snippet: textA.slice(0, 100), rating: fitA });

    return {
      profileName: profile.name,
      textAFit: fitA,
      textBFit: fitB,
      winner: fitA >= fitB ? 'A' : 'B',
      references: referenceLibrary.list(),
    };
  }
}

export const tasteEngine = new TasteEngine();
