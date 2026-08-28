import { navigationScreen } from "./navigation";
import { seaScreen } from "./sea";
import { weatherScreen } from "./weather";
import { windScreen } from "./wind";
import type { Screen } from "@gabrielevierti/glyph";

/**
 * Four screens, in the order you would reach for them: what the boat is doing,
 * what the wind is doing, what the sea is doing, what the sky is about to do.
 */
export const screens: Screen[] = [navigationScreen, windScreen, seaScreen, weatherScreen];
