import { Capacitor } from "@capacitor/core";

// Vrai uniquement dans l'app installée depuis l'App Store ou Google Play.
// Sur le site (navigateur), tout le code natif est ignoré.
export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // "ios" | "android" | "web"
