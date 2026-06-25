export class RegionalToneAdapter {
  adapt(text: string, region: string): { region: string; adapted: string; notes: string[] } {
    const spellings: Record<string, [string, string]> = {
      UK: ['color', 'colour'],
      US: ['colour', 'color'],
    };
    let adapted = text;
    const pair = spellings[region];
    if (pair) adapted = adapted.replace(new RegExp(pair[0], 'gi'), pair[1]);

    return {
      region,
      adapted,
      notes: [`Applied ${region} spelling conventions`, 'Review idioms manually for authenticity'],
    };
  }
}

export const regionalToneAdapter = new RegionalToneAdapter();
