import { GlobalFonts } from '@napi-rs/canvas';

export const alfaFontFamily = 'alfa-regular';
export const lobsterFontFamily = 'lobster-bolditalic';

let fontsRegistered = false;

export function registerCanvasFonts() {
    if (fontsRegistered) return;
    GlobalFonts.registerFromPath('./src/Structures/utils/fonts/AlfaSlabOne-Regular.ttf', alfaFontFamily);
    GlobalFonts.registerFromPath('./src/Structures/utils/fonts/LobsterTwo-BoldItalic.ttf', lobsterFontFamily);
    fontsRegistered = true;
}
