export class VenueCustomiser {
  customise(venueType: string, showType: string) {
    return {
      venueType,
      showType,
      staging: venueType === 'traverse' ? 'In-the-round blocking notes' : 'Proscenium with upstage focus',
      sightlines: 'Ensure centre-stage action visible from all seats',
      loadIn: venueType === 'studio' ? 'Minimal set — 4-hour load-in' : 'Full set — 8-hour load-in',
      generatedAt: new Date().toISOString(),
    };
  }
}

export const venueCustomiser = new VenueCustomiser();
